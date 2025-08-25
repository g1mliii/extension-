-- Queries to monitor function errors

-- 1. Get error summary (most useful for daily monitoring)
SELECT * FROM function_error_summary;

-- 2. Get recent errors (last 24 hours)
SELECT 
    function_name,
    function_type,
    error_message,
    severity,
    created_at,
    request_id,
    url
FROM function_error_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC
LIMIT 50;

-- 3. Get error statistics for specific time period
SELECT * FROM get_function_error_stats(24);  -- Last 24 hours
SELECT * FROM get_function_error_stats(168); -- Last week

-- 4. Get critical errors that need immediate attention
SELECT 
    function_name,
    error_message,
    error_details,
    created_at,
    request_id
FROM function_error_logs 
WHERE severity = 'critical'
AND resolved_at IS NULL
ORDER BY created_at DESC;

-- 5. Get errors for specific function
SELECT 
    error_message,
    error_details,
    created_at,
    severity,
    resolved_at
FROM function_error_logs 
WHERE function_name = 'batch-domain-analysis'  -- Replace with your function name
ORDER BY created_at DESC
LIMIT 20;

-- 6. Mark errors as resolved (after fixing)
-- For specific function:
SELECT resolve_function_errors('batch-domain-analysis');

-- For specific error IDs:
SELECT resolve_function_errors(NULL, ARRAY[1, 2, 3]);

-- 7. Clean up old resolved errors (run monthly)
SELECT cleanup_old_function_errors(30);  -- Keep 30 days

-- 8. Get error trends by hour (for pattern analysis)
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    function_name,
    COUNT(*) as error_count,
    COUNT(DISTINCT error_message) as unique_errors
FROM function_error_logs 
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at), function_name
ORDER BY hour DESC, error_count DESC;