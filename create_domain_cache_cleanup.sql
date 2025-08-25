-- Create domain cache cleanup function and cron job
-- This will clean up expired cache entries to keep the database tidy

-- Create the cleanup function
CREATE OR REPLACE FUNCTION public.cleanup_domain_cache(days_to_keep INTEGER DEFAULT 1)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    deleted_count INTEGER := 0;
    total_expired INTEGER := 0;
BEGIN
    RAISE NOTICE 'Starting domain cache cleanup at %', NOW();
    
    -- Count expired entries before cleanup
    SELECT COUNT(*) INTO total_expired
    FROM domain_cache 
    WHERE cache_expires_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    -- Delete expired cache entries (keep entries that expired less than X days ago)
    DELETE FROM domain_cache 
    WHERE cache_expires_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Domain cache cleanup completed: % expired entries deleted', deleted_count;
    
    -- Also clean up domain_cache_status table (legacy/status table)
    DECLARE
        status_deleted_count INTEGER := 0;
    BEGIN
        -- Clean expired entries from domain_cache_status
        DELETE FROM domain_cache_status 
        WHERE cache_expires_at < NOW() - INTERVAL '1 day' * days_to_keep;
        
        GET DIAGNOSTICS status_deleted_count = ROW_COUNT;
        RAISE NOTICE 'Cleaned up % expired entries from domain_cache_status', status_deleted_count;
        
        -- Also remove orphaned entries (domains not in main cache)
        DELETE FROM domain_cache_status 
        WHERE domain NOT IN (SELECT domain FROM domain_cache);
        
        RAISE NOTICE 'Cleaned up orphaned domain_cache_status entries';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'Error cleaning domain_cache_status: %', SQLERRM;
    END;
    
    RETURN 'Domain cache cleanup completed. Deleted ' || deleted_count || ' expired entries out of ' || total_expired || ' total expired.';
END;
$$;

-- Test the function first (dry run to see what would be deleted)
SELECT 'Testing cleanup function:' as info;
SELECT 
    COUNT(*) as expired_entries_to_delete,
    MIN(cache_expires_at) as oldest_expired,
    MAX(cache_expires_at) as newest_expired
FROM domain_cache 
WHERE cache_expires_at < NOW() - INTERVAL '1 day';

-- Run the cleanup function
SELECT 'Running domain cache cleanup:' as info;
SELECT cleanup_domain_cache(1); -- Keep entries that expired less than 1 day ago

-- Create a cron job to run this daily at 1 AM (before other cleanup jobs)
SELECT cron.schedule(
    'cleanup-domain-cache',
    '0 1 * * *', -- Daily at 1 AM
    'SELECT cleanup_domain_cache(1);'
);

-- Verify the cron job was created
SELECT 'Cron job verification:' as info;
SELECT 
    jobname,
    schedule,
    command,
    active
FROM cron.job 
WHERE jobname = 'cleanup-domain-cache';

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.cleanup_domain_cache(INTEGER) TO postgres;

-- Add function comment
COMMENT ON FUNCTION public.cleanup_domain_cache(INTEGER) IS 'Cleans up expired domain cache entries. Parameter specifies how many days to keep expired entries (default 1 day).';

-- Show final status
SELECT 'Final domain cache status:' as info;
SELECT 
    COUNT(*) as total_entries,
    COUNT(*) FILTER (WHERE cache_expires_at > NOW()) as active_entries,
    COUNT(*) FILTER (WHERE cache_expires_at <= NOW()) as expired_entries,
    ROUND(AVG(EXTRACT(EPOCH FROM (cache_expires_at - NOW()))/3600), 2) as avg_hours_until_expiry
FROM domain_cache;

-- Show updated cron job schedule
SELECT 'Updated cron job schedule:' as info;
SELECT 
    jobname,
    CASE 
        WHEN schedule = '*/5 * * * *' THEN 'Every 5 minutes'
        WHEN schedule = '0 1 * * *' THEN 'Daily at 1 AM'
        WHEN schedule = '0 2 * * *' THEN 'Daily at 2 AM'
        WHEN schedule = '0 3 * * *' THEN 'Daily at 3 AM'
        WHEN schedule = '0 4 * * *' THEN 'Daily at 4 AM'
        ELSE schedule
    END as schedule_description,
    active
FROM cron.job 
WHERE jobname LIKE '%cleanup%' OR jobname LIKE '%aggregate%' OR jobname LIKE '%content%'
ORDER BY 
    CASE 
        WHEN schedule = '*/5 * * * *' THEN 1
        WHEN schedule = '0 1 * * *' THEN 2
        WHEN schedule = '0 2 * * *' THEN 3
        WHEN schedule = '0 3 * * *' THEN 4
        WHEN schedule = '0 4 * * *' THEN 5
        ELSE 6
    END;