-- Verification script for cron job integration with new API implementation
-- Run this after applying the migration to verify everything is working correctly

-- Test 1: Verify cron job exists and has correct schedule
DO $
DECLARE
    job_record RECORD;
BEGIN
    RAISE NOTICE 'TEST 1: Verifying cron job configuration...';
    
    SELECT * INTO job_record
    FROM cron.job 
    WHERE jobname = 'aggregate-ratings-job';
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'FAIL: Cron job aggregate-ratings-job does not exist';
    END IF;
    
    IF job_record.schedule != '*/5 * * * *' THEN
        RAISE EXCEPTION 'FAIL: Cron job has incorrect schedule. Expected: */5 * * * *, Got: %', job_record.schedule;
    END IF;
    
    IF job_record.command != 'SELECT batch_aggregate_ratings();' THEN
        RAISE EXCEPTION 'FAIL: Cron job has incorrect command. Expected: SELECT batch_aggregate_ratings();, Got: %', job_record.command;
    END IF;
    
    RAISE NOTICE 'PASS: Cron job exists with correct configuration';
    RAISE NOTICE '  - Job name: %', job_record.jobname;
    RAISE NOTICE '  - Schedule: %', job_record.schedule;
    RAISE NOTICE '  - Command: %', job_record.command;
    RAISE NOTICE '  - Active: %', job_record.active;
    RAISE NOTICE 'TEST 1: Cron job configuration verified ✓';
END;
$;

-- Test 2: Verify batch_aggregate_ratings function exists and is callable
DO $
DECLARE
    function_exists BOOLEAN;
    test_result TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'TEST 2: Verifying batch_aggregate_ratings function...';
    
    -- Check if function exists
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'batch_aggregate_ratings'
        AND p.pronargs = 0
    ) INTO function_exists;
    
    IF NOT function_exists THEN
        RAISE EXCEPTION 'FAIL: batch_aggregate_ratings function does not exist';
    END IF;
    
    -- Test function execution (this will process any unprocessed ratings)
    BEGIN
        SELECT batch_aggregate_ratings() INTO test_result;
        RAISE NOTICE 'PASS: Function executed successfully';
        RAISE NOTICE '  - Result: %', test_result;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE EXCEPTION 'FAIL: Function execution failed: %', SQLERRM;
    END;
    
    RAISE NOTICE 'TEST 2: batch_aggregate_ratings function verified ✓';
END;
$;

-- Test 3: Verify calculate_enhanced_trust_score function exists
DO $
DECLARE
    function_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'TEST 3: Verifying calculate_enhanced_trust_score function...';
    
    SELECT EXISTS(
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'calculate_enhanced_trust_score'
    ) INTO function_exists;
    
    IF NOT function_exists THEN
        RAISE EXCEPTION 'FAIL: calculate_enhanced_trust_score function does not exist';
    END IF;
    
    RAISE NOTICE 'PASS: calculate_enhanced_trust_score function exists';
    RAISE NOTICE 'TEST 3: Enhanced trust score function verified ✓';
END;
$;

-- Test 4: Verify required tables exist
DO $
DECLARE
    table_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'TEST 4: Verifying required tables exist...';
    
    -- Check ratings table
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'ratings';
    
    IF table_count = 0 THEN
        RAISE EXCEPTION 'FAIL: ratings table does not exist';
    END IF;
    
    -- Check url_stats table
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'url_stats';
    
    IF table_count = 0 THEN
        RAISE EXCEPTION 'FAIL: url_stats table does not exist';
    END IF;
    
    -- Check domain_cache table
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_name = 'domain_cache';
    
    IF table_count = 0 THEN
        RAISE EXCEPTION 'FAIL: domain_cache table does not exist';
    END IF;
    
    RAISE NOTICE 'PASS: All required tables exist (ratings, url_stats, domain_cache)';
    RAISE NOTICE 'TEST 4: Required tables verified ✓';
END;
$;

-- Test 5: Check current processing status
DO $
DECLARE
    unprocessed_count INTEGER;
    total_ratings INTEGER;
    total_url_stats INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'TEST 5: Checking current processing status...';
    
    -- Count unprocessed ratings
    SELECT COUNT(*) INTO unprocessed_count
    FROM public.ratings 
    WHERE processed = false;
    
    -- Count total ratings
    SELECT COUNT(*) INTO total_ratings
    FROM public.ratings;
    
    -- Count URL stats
    SELECT COUNT(*) INTO total_url_stats
    FROM public.url_stats;
    
    RAISE NOTICE 'Current processing status:';
    RAISE NOTICE '  - Total ratings: %', total_ratings;
    RAISE NOTICE '  - Unprocessed ratings: %', unprocessed_count;
    RAISE NOTICE '  - URL stats records: %', total_url_stats;
    
    IF unprocessed_count > 0 THEN
        RAISE NOTICE 'INFO: % unprocessed ratings will be handled by next cron job run', unprocessed_count;
    ELSE
        RAISE NOTICE 'INFO: All ratings are currently processed';
    END IF;
    
    RAISE NOTICE 'TEST 5: Processing status checked ✓';
END;
$;

-- Summary
DO $
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CRON JOB INTEGRATION VERIFICATION COMPLETE ===';
    RAISE NOTICE '';
    RAISE NOTICE 'Cron Job Configuration:';
    RAISE NOTICE '- Name: aggregate-ratings-job';
    RAISE NOTICE '- Schedule: Every 5 minutes (*/5 * * * *)';
    RAISE NOTICE '- Function: batch_aggregate_ratings()';
    RAISE NOTICE '- Integration: Compatible with unified API architecture';
    RAISE NOTICE '';
    RAISE NOTICE 'Background Processing:';
    RAISE NOTICE '- Cron job runs every 5 minutes automatically';
    RAISE NOTICE '- Manual processing available via aggregate-ratings Edge Function';
    RAISE NOTICE '- Enhanced trust scoring with domain analysis';
    RAISE NOTICE '- Consistent processing logic between cron and manual execution';
    RAISE NOTICE '';
    RAISE NOTICE 'Next Steps:';
    RAISE NOTICE '- Cron job will automatically process ratings every 5 minutes';
    RAISE NOTICE '- Monitor logs for successful processing';
    RAISE NOTICE '- Use aggregate-ratings Edge Function for manual processing if needed';
    RAISE NOTICE '';
END;
$;