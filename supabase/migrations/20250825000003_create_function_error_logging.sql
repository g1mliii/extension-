-- Create comprehensive error logging system for functions and edge functions

-- 1. Create function_error_logs table
CREATE TABLE IF NOT EXISTS function_error_logs (
    id BIGSERIAL PRIMARY KEY,
    function_name TEXT NOT NULL,
    function_type TEXT NOT NULL CHECK (function_type IN ('edge_function', 'database_function', 'cron_job')),
    error_message TEXT NOT NULL,
    error_details JSONB,
    request_id TEXT,
    user_id TEXT,
    url TEXT,
    http_status INTEGER,
    stack_trace TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    severity TEXT DEFAULT 'error' CHECK (severity IN ('info', 'warning', 'error', 'critical'))
);

-- 2. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_function_error_logs_function_name ON function_error_logs(function_name);
CREATE INDEX IF NOT EXISTS idx_function_error_logs_created_at ON function_error_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_function_error_logs_severity ON function_error_logs(severity);
CREATE INDEX IF NOT EXISTS idx_function_error_logs_resolved ON function_error_logs(resolved_at) WHERE resolved_at IS NULL;-- 
3. Create function to log errors
CREATE OR REPLACE FUNCTION log_function_error(
    p_function_name TEXT,
    p_function_type TEXT,
    p_error_message TEXT,
    p_error_details JSONB DEFAULT NULL,
    p_request_id TEXT DEFAULT NULL,
    p_user_id TEXT DEFAULT NULL,
    p_url TEXT DEFAULT NULL,
    p_http_status INTEGER DEFAULT NULL,
    p_stack_trace TEXT DEFAULT NULL,
    p_severity TEXT DEFAULT 'error'
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    log_id BIGINT;
BEGIN
    INSERT INTO function_error_logs (
        function_name,
        function_type,
        error_message,
        error_details,
        request_id,
        user_id,
        url,
        http_status,
        stack_trace,
        severity
    ) VALUES (
        p_function_name,
        p_function_type,
        p_error_message,
        p_error_details,
        p_request_id,
        p_user_id,
        p_url,
        p_http_status,
        p_stack_trace,
        p_severity
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$;--
 4. Create function to get error statistics
CREATE OR REPLACE FUNCTION get_function_error_stats(
    p_hours INTEGER DEFAULT 24
)
RETURNS TABLE (
    function_name TEXT,
    function_type TEXT,
    error_count BIGINT,
    last_error TIMESTAMP WITH TIME ZONE,
    most_common_error TEXT,
    severity_breakdown JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        fel.function_name,
        fel.function_type,
        COUNT(*) as error_count,
        MAX(fel.created_at) as last_error,
        (
            SELECT error_message 
            FROM function_error_logs 
            WHERE function_name = fel.function_name 
            GROUP BY error_message 
            ORDER BY COUNT(*) DESC 
            LIMIT 1
        ) as most_common_error,
        jsonb_object_agg(fel.severity, severity_count) as severity_breakdown
    FROM function_error_logs fel
    CROSS JOIN LATERAL (
        SELECT COUNT(*) as severity_count
        FROM function_error_logs fel2
        WHERE fel2.function_name = fel.function_name
        AND fel2.severity = fel.severity
        AND fel2.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    ) sc
    WHERE fel.created_at > NOW() - (p_hours || ' hours')::INTERVAL
    GROUP BY fel.function_name, fel.function_type
    ORDER BY error_count DESC;
END;
$$;-- 5. C
reate view for easy error monitoring
CREATE OR REPLACE VIEW function_error_summary AS
SELECT 
    function_name,
    function_type,
    COUNT(*) as total_errors,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as errors_last_hour,
    COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours') as errors_last_24h,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_errors,
    COUNT(*) FILTER (WHERE resolved_at IS NULL) as unresolved_errors,
    MAX(created_at) as last_error_at,
    MIN(created_at) as first_error_at
FROM function_error_logs
GROUP BY function_name, function_type
ORDER BY errors_last_24h DESC, total_errors DESC;

-- 6. Create function to mark errors as resolved
CREATE OR REPLACE FUNCTION resolve_function_errors(
    p_function_name TEXT DEFAULT NULL,
    p_error_ids BIGINT[] DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    updated_count INTEGER;
BEGIN
    IF p_error_ids IS NOT NULL THEN
        -- Resolve specific error IDs
        UPDATE function_error_logs 
        SET resolved_at = NOW()
        WHERE id = ANY(p_error_ids)
        AND resolved_at IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
    ELSIF p_function_name IS NOT NULL THEN
        -- Resolve all unresolved errors for a function
        UPDATE function_error_logs 
        SET resolved_at = NOW()
        WHERE function_name = p_function_name
        AND resolved_at IS NULL;
        GET DIAGNOSTICS updated_count = ROW_COUNT;
    ELSE
        RAISE EXCEPTION 'Must provide either function_name or error_ids';
    END IF;
    
    RETURN updated_count;
END;
$$;-- 7.
 Create cleanup function for old logs
CREATE OR REPLACE FUNCTION cleanup_old_function_errors(
    p_days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM function_error_logs
    WHERE created_at < NOW() - (p_days_to_keep || ' days')::INTERVAL
    AND resolved_at IS NOT NULL;  -- Only delete resolved errors
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$;

-- 8. Add RLS policies
ALTER TABLE function_error_logs ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything
CREATE POLICY "Service role can manage all error logs" ON function_error_logs
    FOR ALL USING (auth.role() = 'service_role');

-- Allow authenticated users to read error logs (for debugging)
CREATE POLICY "Authenticated users can read error logs" ON function_error_logs
    FOR SELECT USING (auth.role() = 'authenticated');

-- 9. Add comments for documentation
COMMENT ON TABLE function_error_logs IS 'Centralized error logging for all functions and edge functions';
COMMENT ON FUNCTION log_function_error IS 'Log errors from functions with detailed context';
COMMENT ON FUNCTION get_function_error_stats IS 'Get error statistics for monitoring';
COMMENT ON VIEW function_error_summary IS 'Summary view of function errors for dashboard';
COMMENT ON FUNCTION resolve_function_errors IS 'Mark errors as resolved';
COMMENT ON FUNCTION cleanup_old_function_errors IS 'Clean up old resolved errors';

-- 10. Create initial test log entry
SELECT log_function_error(
    'error_logging_system',
    'database_function',
    'Error logging system initialized successfully',
    '{"version": "1.0", "features": ["centralized_logging", "error_stats", "cleanup"]}'::jsonb,
    'init-' || extract(epoch from now())::text,
    NULL,
    NULL,
    NULL,
    NULL,
    'info'
);