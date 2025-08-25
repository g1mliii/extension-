-- Check cache cleanup cron jobs and domain cache status

-- 1. Show all cron jobs to see what cleanup jobs exist
SELECT 'All cron jobs:' as info;
SELECT 
    jobname,
    schedule,
    command,
    active,
    -- Decode the schedule
    CASE 
        WHEN schedule = '*/5 * * * *' THEN 'Every 5 minutes'
        WHEN schedule = '0 2 * * *' THEN 'Daily at 2 AM'
        WHEN schedule = '0 3 * * *' THEN 'Daily at 3 AM'
        WHEN schedule = '0 4 * * *' THEN 'Daily at 4 AM'
        ELSE schedule
    END as schedule_description
FROM cron.job 
ORDER BY jobname;

-- 2. Check domain cache status
SELECT 'Domain cache status:' as info;
SELECT 
    COUNT(*) as total_cached_domains,
    COUNT(*) FILTER (WHERE cache_expires_at > NOW()) as active_cache_entries,
    COUNT(*) FILTER (WHERE cache_expires_at <= NOW()) as expired_cache_entries,
    MIN(cache_expires_at) as oldest_expiry,
    MAX(cache_expires_at) as newest_expiry,
    AVG(EXTRACT(EPOCH FROM (cache_expires_at - NOW()))/3600) as avg_hours_until_expiry
FROM domain_cache;

-- 3. Show sample expired cache entries
SELECT 'Sample expired cache entries:' as info;
SELECT 
    domain,
    last_checked,
    cache_expires_at,
    EXTRACT(EPOCH FROM (NOW() - cache_expires_at))/3600 as hours_expired
FROM domain_cache 
WHERE cache_expires_at <= NOW()
ORDER BY cache_expires_at DESC
LIMIT 10;

-- 4. Check if there's a specific domain cache cleanup function
SELECT 'Domain cache cleanup function exists?' as info;
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' AND p.proname LIKE '%cache%cleanup%'
        ) THEN 'YES - domain cache cleanup function exists'
        WHEN EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' AND p.proname LIKE '%cleanup%cache%'
        ) THEN 'YES - cache cleanup function exists'
        ELSE 'NO - no specific cache cleanup function found'
    END as cache_cleanup_status;

-- 5. Show what the existing cleanup functions do
SELECT 'Existing cleanup functions:' as info;
SELECT 
    p.proname as function_name,
    pg_get_function_result(p.oid) as returns,
    obj_description(p.oid) as description
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
AND p.proname LIKE '%cleanup%'
ORDER BY p.proname;

-- 6. Check recent cron job execution for cleanup jobs
SELECT 'Recent cleanup job executions:' as info;
SELECT 
    j.jobname,
    jrd.start_time,
    jrd.end_time,
    jrd.return_message,
    CASE 
        WHEN jrd.return_message LIKE 'ERROR%' THEN '❌ FAILED'
        WHEN jrd.return_message IS NOT NULL THEN '✅ SUCCESS'
        ELSE '⏳ RUNNING'
    END as status
FROM cron.job j
LEFT JOIN cron.job_run_details jrd ON j.jobid = jrd.jobid
WHERE j.jobname LIKE '%cleanup%'
AND jrd.start_time > NOW() - INTERVAL '7 days'
ORDER BY jrd.start_time DESC
LIMIT 20;

-- 7. Recommendation for domain cache cleanup
SELECT 'Cache cleanup recommendations:' as info;
SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM domain_cache WHERE cache_expires_at <= NOW()) > 100 THEN
            'RECOMMENDED: Create domain cache cleanup cron job - you have ' || 
            (SELECT COUNT(*) FROM domain_cache WHERE cache_expires_at <= NOW()) || 
            ' expired cache entries'
        WHEN (SELECT COUNT(*) FROM domain_cache WHERE cache_expires_at <= NOW()) > 0 THEN
            'OPTIONAL: ' || 
            (SELECT COUNT(*) FROM domain_cache WHERE cache_expires_at <= NOW()) || 
            ' expired cache entries could be cleaned up'
        ELSE 'GOOD: No expired cache entries found'
    END as recommendation;