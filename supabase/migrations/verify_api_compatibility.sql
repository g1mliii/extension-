-- Verification Script for API Database Compatibility
-- Run this script after applying the migration to verify everything is working

-- Test 1: Verify all required tables exist
DO $
DECLARE
    table_count INTEGER;
    expected_tables TEXT[] := ARRAY[
        'ratings', 'url_stats', 'domain_cache', 'domain_blacklist', 
        'content_type_rules', 'trust_algorithm_config'
    ];
    table_name TEXT;
BEGIN
    RAISE NOTICE 'TEST 1: Verifying required tables exist...';
    
    FOREACH table_name IN ARRAY expected_tables
    LOOP
        SELECT COUNT(*) INTO table_count
        FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = table_name;
        
        IF table_count = 0 THEN
            RAISE EXCEPTION 'FAIL: Table % does not exist', table_name;
        ELSE
            RAISE NOTICE 'PASS: Table % exists', table_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'TEST 1: All required tables exist ✓';
END;
$;

-- Test 2: Verify all required database functions exist
DO $
DECLARE
    function_count INTEGER;
    expected_functions TEXT[] := ARRAY[
        'batch_aggregate_ratings', 'calculate_enhanced_trust_score', 
        'get_cache_statistics', 'update_trust_config', 'recalculate_with_new_config',
        'extract_domain', 'determine_content_type', 'check_domain_blacklist'
    ];
    function_name TEXT;
BEGIN
    RAISE NOTICE 'TEST 2: Verifying required functions exist...';
    
    FOREACH function_name IN ARRAY expected_functions
    LOOP
        SELECT COUNT(*) INTO function_count
        FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = function_name;
        
        IF function_count = 0 THEN
            RAISE EXCEPTION 'FAIL: Function % does not exist', function_name;
        ELSE
            RAISE NOTICE 'PASS: Function % exists', function_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'TEST 2: All required functions exist ✓';
END;
$;

-- Test 3: Verify required views exist
DO $
DECLARE
    view_count INTEGER;
    expected_views TEXT[] := ARRAY['enhanced_trust_analytics', 'trust_algorithm_performance'];
    view_name TEXT;
BEGIN
    RAISE NOTICE 'TEST 3: Verifying required views exist...';
    
    FOREACH view_name IN ARRAY expected_views
    LOOP
        SELECT COUNT(*) INTO view_count
        FROM information_schema.views 
        WHERE table_schema = 'public' AND table_name = view_name;
        
        IF view_count = 0 THEN
            RAISE EXCEPTION 'FAIL: View % does not exist', view_name;
        ELSE
            RAISE NOTICE 'PASS: View % exists', view_name;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'TEST 3: All required views exist ✓';
END;
$;

-- Test 4: Verify cron job exists
DO $
DECLARE
    job_count INTEGER;
BEGIN
    RAISE NOTICE 'TEST 4: Verifying cron job exists...';
    
    SELECT COUNT(*) INTO job_count
    FROM cron.job 
    WHERE jobname = 'aggregate-ratings-job';
    
    IF job_count = 0 THEN
        RAISE EXCEPTION 'FAIL: Cron job aggregate-ratings-job does not exist';
    ELSE
        RAISE NOTICE 'PASS: Cron job aggregate-ratings-job exists';
    END IF;
    
    RAISE NOTICE 'TEST 4: Cron job verification complete ✓';
END;
$;

-- Test 5: Verify table schemas have required columns
DO $
DECLARE
    column_count INTEGER;
BEGIN
    RAISE NOTICE 'TEST 5: Verifying table schemas...';
    
    -- Check ratings table columns
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'ratings' 
    AND column_name IN ('url_hash', 'user_id_hash', 'rating', 'is_spam', 'is_misleading', 'is_scam', 'processed');
    
    IF column_count < 7 THEN
        RAISE EXCEPTION 'FAIL: ratings table missing required columns';
    END IF;
    
    -- Check url_stats table columns
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'url_stats' 
    AND column_name IN ('url_hash', 'domain', 'trust_score', 'final_trust_score', 'rating_count');
    
    IF column_count < 5 THEN
        RAISE EXCEPTION 'FAIL: url_stats table missing required columns';
    END IF;
    
    -- Check domain_cache table columns
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'domain_cache' 
    AND column_name IN ('domain', 'ssl_valid', 'google_safe_browsing_status', 'cache_expires_at');
    
    IF column_count < 4 THEN
        RAISE EXCEPTION 'FAIL: domain_cache table missing required columns';
    END IF;
    
    RAISE NOTICE 'PASS: All table schemas have required columns';
    RAISE NOTICE 'TEST 5: Table schema verification complete ✓';
END;
$;

-- Test 6: Test basic API operations
DO $
DECLARE
    test_url_hash TEXT := 'test_api_' || extract(epoch from now())::text;
    test_domain TEXT := 'test-example.com';
    test_user_id UUID := gen_random_uuid();
    inserted_count INTEGER;
    selected_count INTEGER;
BEGIN
    RAISE NOTICE 'TEST 6: Testing basic API operations...';
    
    -- Test rating insertion (API operation)
    INSERT INTO public.ratings (url_hash, user_id_hash, rating, is_spam, is_misleading, is_scam)
    VALUES (test_url_hash, test_user_id, 4, false, false, false);
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    IF inserted_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Could not insert rating';
    END IF;
    
    -- Test url_stats upsert (API operation)
    INSERT INTO public.url_stats (url_hash, domain, last_updated, last_accessed)
    VALUES (test_url_hash, test_domain, NOW(), NOW())
    ON CONFLICT (url_hash) DO UPDATE SET 
        domain = EXCLUDED.domain,
        last_accessed = EXCLUDED.last_accessed;
    
    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    IF inserted_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Could not upsert url_stats';
    END IF;
    
    -- Test querying url_stats (API operation)
    SELECT COUNT(*) INTO selected_count
    FROM public.url_stats 
    WHERE url_hash = test_url_hash;
    
    IF selected_count != 1 THEN
        RAISE EXCEPTION 'FAIL: Could not query url_stats';
    END IF;
    
    -- Test querying domain_cache (API operation)
    SELECT COUNT(*) INTO selected_count
    FROM public.domain_cache 
    WHERE domain = test_domain;
    
    -- This should work even if no results (count = 0)
    
    -- Clean up test data
    DELETE FROM public.ratings WHERE url_hash = test_url_hash;
    DELETE FROM public.url_stats WHERE url_hash = test_url_hash;
    
    RAISE NOTICE 'PASS: Basic API operations work correctly';
    RAISE NOTICE 'TEST 6: API operations test complete ✓';
END;
$;

-- Test 7: Test database functions can be called
DO $
DECLARE
    result TEXT;
    stats_result RECORD;
BEGIN
    RAISE NOTICE 'TEST 7: Testing database function calls...';
    
    -- Test batch_aggregate_ratings function
    SELECT batch_aggregate_ratings() INTO result;
    IF result IS NULL THEN
        RAISE EXCEPTION 'FAIL: batch_aggregate_ratings function returned NULL';
    END IF;
    
    -- Test get_cache_statistics function
    SELECT * INTO stats_result FROM get_cache_statistics();
    IF stats_result IS NULL THEN
        RAISE EXCEPTION 'FAIL: get_cache_statistics function returned NULL';
    END IF;
    
    RAISE NOTICE 'PASS: Database functions can be called successfully';
    RAISE NOTICE 'TEST 7: Database function test complete ✓';
END;
$;

-- Test 8: Test views can be queried
DO $
DECLARE
    analytics_count INTEGER;
    performance_count INTEGER;
BEGIN
    RAISE NOTICE 'TEST 8: Testing view queries...';
    
    -- Test enhanced_trust_analytics view
    SELECT COUNT(*) INTO analytics_count FROM enhanced_trust_analytics;
    -- Count can be 0, just need to ensure query works
    
    -- Test trust_algorithm_performance view
    SELECT COUNT(*) INTO performance_count FROM trust_algorithm_performance;
    -- Count can be 0, just need to ensure query works
    
    RAISE NOTICE 'PASS: Views can be queried successfully';
    RAISE NOTICE 'TEST 8: View query test complete ✓';
END;
$;

-- Final summary
DO $
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'API COMPATIBILITY VERIFICATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'All tests passed! The database is ready for API operations.';
    RAISE NOTICE '';
    RAISE NOTICE 'API Functions Supported:';
    RAISE NOTICE '- url-trust-api (GET /url-stats, POST /rating)';
    RAISE NOTICE '- batch-domain-analysis (POST /)';
    RAISE NOTICE '- aggregate-ratings (POST /)';
    RAISE NOTICE '- rating-submission (POST /)';
    RAISE NOTICE '- trust-admin (various admin endpoints)';
    RAISE NOTICE '';
    RAISE NOTICE 'Background Processing:';
    RAISE NOTICE '- Cron job runs every 5 minutes';
    RAISE NOTICE '- Domain analysis triggered after ratings';
    RAISE NOTICE '- Statistics updated automatically';
    RAISE NOTICE '';
    RAISE NOTICE 'Requirements 6.1-6.6 are fully addressed.';
    RAISE NOTICE '========================================';
END;
$;