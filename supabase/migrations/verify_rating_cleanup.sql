-- Verification script for rating cleanup system
-- Run this after applying the migration to verify everything is working

DO $
DECLARE
    function_exists BOOLEAN;
    cron_job_exists BOOLEAN;
    job_record RECORD;
    stats_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== RATING CLEANUP SYSTEM VERIFICATION ===';
    RAISE NOTICE '';
    
    -- Test 1: Verify cleanup function exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'cleanup_processed_ratings'
        AND routine_type = 'FUNCTION'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✓ cleanup_processed_ratings function exists';
    ELSE
        RAISE EXCEPTION '✗ cleanup_processed_ratings function not found';
    END IF;
    
    -- Test 2: Verify stats function exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'get_rating_cleanup_stats'
        AND routine_type = 'FUNCTION'
    ) INTO function_exists;
    
    IF function_exists THEN
        RAISE NOTICE '✓ get_rating_cleanup_stats function exists';
    ELSE
        RAISE EXCEPTION '✗ get_rating_cleanup_stats function not found';
    END IF;
    
    -- Test 3: Verify cron job exists
    SELECT EXISTS (
        SELECT 1 FROM cron.job 
        WHERE jobname = 'cleanup-processed-ratings'
    ) INTO cron_job_exists;
    
    IF cron_job_exists THEN
        RAISE NOTICE '✓ cleanup-processed-ratings cron job exists';
        
        -- Get cron job details
        SELECT * INTO job_record
        FROM cron.job 
        WHERE jobname = 'cleanup-processed-ratings';
        
        RAISE NOTICE '  - Schedule: %', job_record.schedule;
        RAISE NOTICE '  - Command: %', job_record.command;
        RAISE NOTICE '  - Active: %', job_record.active;
    ELSE
        RAISE EXCEPTION '✗ cleanup-processed-ratings cron job not found';
    END IF;
    
    -- Test 4: Test function execution
    BEGIN
        DECLARE
            test_result TEXT;
        BEGIN
            SELECT cleanup_processed_ratings(7) INTO test_result;
            RAISE NOTICE '✓ Function execution successful: %', test_result;
        END;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '✗ Function execution failed: %', SQLERRM;
    END;
    
    -- Test 5: Test stats function
    BEGIN
        SELECT * INTO stats_record FROM get_rating_cleanup_stats();
        RAISE NOTICE '✓ Stats function working';
        RAISE NOTICE '  - Total ratings: %', stats_record.total_ratings;
        RAISE NOTICE '  - Processed ratings: %', stats_record.processed_ratings;
        RAISE NOTICE '  - Eligible for cleanup: %', stats_record.ratings_eligible_for_cleanup;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION '✗ Stats function failed: %', SQLERRM;
    END;
    
    RAISE NOTICE '';
    RAISE NOTICE '=== ALL TESTS PASSED ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Rating Cleanup System is ready:';
    RAISE NOTICE '- Processed ratings will be deleted after 7 days';
    RAISE NOTICE '- Cleanup runs daily at 3:00 AM';
    RAISE NOTICE '- Use get_rating_cleanup_stats() to monitor';
    RAISE NOTICE '- Manual cleanup: SELECT cleanup_processed_ratings(7);';
    RAISE NOTICE '';
    
END;
$;