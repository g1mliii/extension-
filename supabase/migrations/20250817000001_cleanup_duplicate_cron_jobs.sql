-- Clean up duplicate cron jobs
-- Remove redundant enhanced-processing-job and keep only aggregate-ratings-job

DO $
DECLARE
    job_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CRON JOB CLEANUP ===';
    RAISE NOTICE '';
    
    -- Check if enhanced-processing-job exists
    SELECT EXISTS (
        SELECT 1 FROM cron.job 
        WHERE jobname = 'enhanced-processing-job'
    ) INTO job_exists;
    
    IF job_exists THEN
        -- Remove the duplicate enhanced-processing-job
        PERFORM cron.unschedule('enhanced-processing-job');
        RAISE NOTICE '✓ Removed duplicate enhanced-processing-job';
        RAISE NOTICE '  - This job was running batch_aggregate_ratings() twice every 5 minutes';
        RAISE NOTICE '  - The aggregate-ratings-job already handles rating processing';
    ELSE
        RAISE NOTICE '✓ No enhanced-processing-job found (already clean)';
    END IF;
    
    -- Verify remaining jobs
    RAISE NOTICE '';
    RAISE NOTICE 'Remaining cron jobs:';
    
    FOR job_exists IN 
        SELECT true FROM cron.job WHERE jobname = 'aggregate-ratings-job'
    LOOP
        RAISE NOTICE '✓ aggregate-ratings-job (*/5 * * * *) - Processes ratings every 5 minutes';
    END LOOP;
    
    FOR job_exists IN 
        SELECT true FROM cron.job WHERE jobname = 'cleanup-processed-ratings'
    LOOP
        RAISE NOTICE '✓ cleanup-processed-ratings (0 3 * * *) - Cleans old ratings daily';
    END LOOP;
    
    FOR job_exists IN 
        SELECT true FROM cron.job WHERE jobname = 'cleanup-old-urls'
    LOOP
        RAISE NOTICE '✓ cleanup-old-urls (0 2 * * *) - Cleans old URL stats daily';
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== CLEANUP COMPLETE ===';
    RAISE NOTICE 'Optimal cron job configuration:';
    RAISE NOTICE '- 1 job processes ratings (every 5 min)';
    RAISE NOTICE '- 1 job cleans old ratings (daily)';
    RAISE NOTICE '- 1 job cleans old URLs (daily)';
    RAISE NOTICE '- No duplicate processing';
END;
$;