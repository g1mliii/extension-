-- Setup cron jobs using cron.schedule function (simpler approach)
-- This avoids permission issues with direct table updates

-- 1. Remove existing jobs if they exist (ignore errors if they don't exist)
DO $$
BEGIN
    -- Try to unschedule batch-domain-analysis-job if it exists
    BEGIN
        PERFORM cron.unschedule('batch-domain-analysis-job');
        RAISE NOTICE 'Removed existing batch-domain-analysis-job';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'batch-domain-analysis-job did not exist (this is fine)';
    END;
    
    -- Try to unschedule auto-generate-content-rules if it exists
    BEGIN
        PERFORM cron.unschedule('auto-generate-content-rules');
        RAISE NOTICE 'Removed existing auto-generate-content-rules';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'auto-generate-content-rules did not exist (this is fine)';
    END;
END $$;

-- 3. Create auto-generate-content-rules at 2:30 AM (BEFORE cleanup at 3 AM)
SELECT cron.schedule(
    'auto-generate-content-rules',
    '30 2 * * *',  -- 2:30 AM
    'SELECT auto_generate_content_rules();'
);

-- 4. Create batch-domain-analysis-job at 1:00 AM (daily, API-friendly)
SELECT cron.schedule(
    'batch-domain-analysis-job',
    '0 1 * * *',  -- Daily at 1:00 AM
    $CRON$
    SELECT net.http_post(
        url := 'http://localhost:54321/functions/v1/batch-domain-analysis',
        headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || 
                   (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key') || '"}',
        body := '{"limit": 20, "priority": "normal"}'::jsonb
    );
    $CRON$
);

-- 5. Show final schedule
SELECT 
    jobname,
    schedule,
    active,
    CASE jobname
        WHEN 'batch-domain-analysis-job' THEN '1. Daily at 1:00 AM - WHOIS & domain analysis'
        WHEN 'cleanup-old-urls' THEN '2. Daily at 2:00 AM - Clean old URLs'
        WHEN 'auto-generate-content-rules' THEN '3. Daily at 2:30 AM - Generate content rules (FIXED)'
        WHEN 'cleanup-processed-ratings' THEN '4. Daily at 3:00 AM - Clean processed ratings'
        WHEN 'aggregate-ratings-job' THEN '5. Every 5 minutes - Aggregate ratings'
        ELSE 'Other job'
    END as description
FROM cron.job 
WHERE active = true
ORDER BY 
    CASE jobname
        WHEN 'batch-domain-analysis-job' THEN 1
        WHEN 'cleanup-old-urls' THEN 2
        WHEN 'auto-generate-content-rules' THEN 3
        WHEN 'cleanup-processed-ratings' THEN 4
        WHEN 'aggregate-ratings-job' THEN 5
        ELSE 99
    END;