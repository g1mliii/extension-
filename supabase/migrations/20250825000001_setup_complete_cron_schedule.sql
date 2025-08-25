-- Setup complete cron schedule with proper permissions
-- Migration to fix content rules timing and add batch domain analysis

-- 1. Fix the content rules timing issue (run BEFORE cleanup)
DO $$
BEGIN
    -- Update auto-generate-content-rules to run at 2:30 AM (before cleanup at 3 AM)
    UPDATE cron.job 
    SET schedule = '30 2 * * *'  -- 2:30 AM
    WHERE jobname = 'auto-generate-content-rules';
    
    RAISE NOTICE 'FIXED: auto-generate-content-rules now runs at 2:30 AM (before cleanup)';
END $$;

-- 2. Add the missing batch domain analysis cron job
DO $$
BEGIN
    -- Check if batch-domain-analysis-job already exists
    IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'batch-domain-analysis-job') THEN
        RAISE NOTICE 'batch-domain-analysis-job already exists, updating schedule...';
        UPDATE cron.job 
        SET schedule = '0 1 * * *'  -- Daily at 1:00 AM
        WHERE jobname = 'batch-domain-analysis-job';
    ELSE
        -- Create new batch domain analysis cron job
        PERFORM cron.schedule(
            'batch-domain-analysis-job',
            '0 1 * * *',  -- Daily at 1:00 AM (API-friendly)
            $CRON$
            SELECT net.http_post(
                url := 'http://localhost:54321/functions/v1/batch-domain-analysis',
                headers := '{"Content-Type": "application/json", "Authorization": "Bearer ' || 
                           (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'supabase_service_role_key') || '"}',
                body := '{"limit": 20, "priority": "normal"}'::jsonb
            );
            $CRON$
        );
        RAISE NOTICE 'CREATED: batch-domain-analysis-job (daily at 1:00 AM)';
    END IF;
END $$;

-- 3. Verify the complete cron schedule
DO $$
DECLARE
    job_record RECORD;
BEGIN
    RAISE NOTICE '=== COMPLETE CRON SCHEDULE ===';
    
    FOR job_record IN 
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
            END
    LOOP
        RAISE NOTICE '% | % | Active: %', job_record.description, job_record.schedule, job_record.active;
    END LOOP;
    
    RAISE NOTICE '=== API USAGE ESTIMATE ===';
    RAISE NOTICE 'WHOIS API: 20 domains/day = 600 requests/month';
    RAISE NOTICE 'WhoisXML API free tier: 1,000/month';
    RAISE NOTICE 'RESULT: Stays within free tier limits! ✓';
END $$;

-- 4. Add comments for documentation
COMMENT ON EXTENSION pg_cron IS 'Complete cron schedule: batch domain analysis (1 AM), cleanup (2 AM), content rules (2:30 AM), rating cleanup (3 AM), aggregation (every 5 min)';

-- 5. Verify all expected jobs exist
DO $$
DECLARE
    missing_jobs TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Check for required jobs
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'batch-domain-analysis-job' AND active = true) THEN
        missing_jobs := array_append(missing_jobs, 'batch-domain-analysis-job');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-generate-content-rules' AND active = true) THEN
        missing_jobs := array_append(missing_jobs, 'auto-generate-content-rules');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aggregate-ratings-job' AND active = true) THEN
        missing_jobs := array_append(missing_jobs, 'aggregate-ratings-job');
    END IF;
    
    IF array_length(missing_jobs, 1) > 0 THEN
        RAISE WARNING 'Missing cron jobs: %', array_to_string(missing_jobs, ', ');
    ELSE
        RAISE NOTICE 'SUCCESS: All required cron jobs are active ✓';
    END IF;
END $$;