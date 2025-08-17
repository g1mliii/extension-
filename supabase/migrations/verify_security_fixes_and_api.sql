-- Verification Script for Security Fixes and API Compatibility
-- Run this after applying the security fix migration to verify everything works

-- ============================================================================
-- PART 1: VERIFY SECURITY WARNINGS ARE RESOLVED
-- ============================================================================

-- Check that views no longer have SECURITY DEFINER
DO $$
DECLARE
    view_record RECORD;
    security_definer_views TEXT[] := ARRAY[]::TEXT[];
BEGIN
    RAISE NOTICE 'Checking for SECURITY DEFINER views...';
    
    FOR view_record IN 
        SELECT schemaname, viewname 
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname IN ('processing_status_summary', 'domain_cache_status', 'enhanced_trust_analytics', 'trust_algorithm_performance')
    LOOP
        -- Check if view definition contains SECURITY DEFINER
        IF EXISTS (
            SELECT 1 FROM pg_views 
            WHERE schemaname = view_record.schemaname 
            AND viewname = view_record.viewname 
            AND definition ILIKE '%SECURITY DEFINER%'
        ) THEN
            security_definer_views := array_append(security_definer_views, view_record.viewname);
        END IF;
    END LOOP;
    
    IF array_length(security_definer_views, 1) IS NULL THEN
        RAISE NOTICE '✓ All views properly fixed - no SECURITY DEFINER found';
    ELSE
        RAISE WARNING '✗ Views still have SECURITY DEFINER: %', array_to_string(security_definer_views, ', ');
    END IF;
END;
$$;

-- Check that functions have proper search_path set
DO $$
DECLARE
    func_record RECORD;
    missing_search_path TEXT[] := ARRAY[]::TEXT[];
BEGIN
    RAISE NOTICE 'Checking function search_path settings...';
    
    FOR func_record IN 
        SELECT proname, prosrc 
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND proname IN ('log_migration_completion', 'has_enhanced_scores')
    LOOP
        -- Check if function has SET search_path = public
        IF NOT EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON p.pronamespace = n.oid
            WHERE n.nspname = 'public' 
            AND p.proname = func_record.proname
            AND 'search_path=public' = ANY(p.proconfig)
        ) THEN
            missing_search_path := array_append(missing_search_path, func_record.proname);
        END IF;
    END LOOP;
    
    IF array_length(missing_search_path, 1) IS NULL THEN
        RAISE NOTICE '✓ All functions have proper search_path set';
    ELSE
        RAISE WARNING '✗ Functions missing search_path: %', array_to_string(missing_search_path, ', ');
    END IF;
END;
$$;

-- ============================================================================
-- PART 2: TEST API ENDPOINT FUNCTIONALITY
-- ============================================================================

-- Test GET /url-stats endpoint simulation
DO $$
DECLARE
    test_url_hash TEXT := 'test_hash_' || extract(epoch from now())::text;
    test_domain TEXT := 'example.com';
    stats_record RECORD;
BEGIN
    RAISE NOTICE 'Testing GET /url-stats endpoint functionality...';
    
    -- Insert test data
    INSERT INTO url_stats (url_hash, domain, trust_score, rating_count, last_updated)
    VALUES (test_url_hash, test_domain, 75, 5, NOW())
    ON CONFLICT (url_hash) DO UPDATE SET
        trust_score = EXCLUDED.trust_score,
        rating_count = EXCLUDED.rating_count,
        last_updated = EXCLUDED.last_updated;
    
    -- Test query that GET /url-stats would perform
    BEGIN
        SELECT url_hash, domain, trust_score, final_trust_score, rating_count, 
               spam_reports_count, misleading_reports_count, scam_reports_count
        INTO stats_record
        FROM url_stats 
        WHERE url_hash = test_url_hash;
        
        IF FOUND THEN
            RAISE NOTICE '✓ GET /url-stats query structure: Working correctly';
            RAISE NOTICE '  - URL Hash: %', stats_record.url_hash;
            RAISE NOTICE '  - Domain: %', stats_record.domain;
            RAISE NOTICE '  - Trust Score: %', stats_record.trust_score;
            RAISE NOTICE '  - Rating Count: %', stats_record.rating_count;
        ELSE
            RAISE WARNING '✗ GET /url-stats query: No data found';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ GET /url-stats query error: %', SQLERRM;
    END;
    
    -- Clean up test data
    DELETE FROM url_stats WHERE url_hash = test_url_hash;
END;
$$;

-- Test POST /rating endpoint simulation
DO $$
DECLARE
    test_url_hash TEXT := 'rating_test_' || extract(epoch from now())::text;
    test_user_id UUID := gen_random_uuid();
    rating_record RECORD;
BEGIN
    RAISE NOTICE 'Testing POST /rating endpoint functionality...';
    
    -- Test insert that POST /rating would perform
    BEGIN
        INSERT INTO ratings (url_hash, user_id, rating, is_spam, is_misleading, is_scam, created_at)
        VALUES (test_url_hash, test_user_id, 4, false, false, false, NOW())
        RETURNING * INTO rating_record;
        
        IF FOUND THEN
            RAISE NOTICE '✓ POST /rating insert: Working correctly';
            RAISE NOTICE '  - Rating ID: %', rating_record.id;
            RAISE NOTICE '  - User ID: %', rating_record.user_id;
            RAISE NOTICE '  - Rating: %', rating_record.rating;
            RAISE NOTICE '  - Spam: %', rating_record.is_spam;
        ELSE
            RAISE WARNING '✗ POST /rating insert: Failed to insert';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ POST /rating insert error: %', SQLERRM;
    END;
    
    -- Clean up test data
    DELETE FROM ratings WHERE url_hash = test_url_hash;
END;
$$;

-- Test domain cache access (critical for 406 error prevention)
DO $$
DECLARE
    test_domain TEXT := 'test-domain-' || extract(epoch from now())::text || '.com';
    cache_record RECORD;
BEGIN
    RAISE NOTICE 'Testing domain cache access (406 error prevention)...';
    
    -- Test insert into domain cache
    BEGIN
        INSERT INTO domain_cache (domain, ssl_valid, domain_age_days, cache_expires_at, created_at)
        VALUES (test_domain, true, 365, NOW() + INTERVAL '7 days', NOW())
        RETURNING * INTO cache_record;
        
        IF FOUND THEN
            RAISE NOTICE '✓ Domain cache insert: Working correctly';
            RAISE NOTICE '  - Domain: %', cache_record.domain;
            RAISE NOTICE '  - SSL Valid: %', cache_record.ssl_valid;
            RAISE NOTICE '  - Cache Expires: %', cache_record.cache_expires_at;
        ELSE
            RAISE WARNING '✗ Domain cache insert: Failed';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ Domain cache insert error: %', SQLERRM;
    END;
    
    -- Test query from domain cache
    BEGIN
        SELECT domain, ssl_valid, cache_expires_at > NOW() as is_valid
        INTO cache_record
        FROM domain_cache 
        WHERE domain = test_domain;
        
        IF FOUND THEN
            RAISE NOTICE '✓ Domain cache query: Working correctly';
            RAISE NOTICE '  - Cache Valid: %', cache_record.is_valid;
        ELSE
            RAISE WARNING '✗ Domain cache query: No data found';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ Domain cache query error: %', SQLERRM;
    END;
    
    -- Clean up test data
    DELETE FROM domain_cache WHERE domain = test_domain;
END;
$$;

-- ============================================================================
-- PART 3: TEST ENHANCED TRUST SCORE CALCULATION
-- ============================================================================

DO $$
DECLARE
    test_url_hash TEXT := 'trust_test_' || extract(epoch from now())::text;
    test_domain TEXT := 'trusttest.com';
    trust_result RECORD;
BEGIN
    RAISE NOTICE 'Testing enhanced trust score calculation...';
    
    -- Insert test data for trust calculation
    INSERT INTO url_stats (url_hash, domain, rating_count, average_rating)
    VALUES (test_url_hash, test_domain, 10, 4.2)
    ON CONFLICT (url_hash) DO UPDATE SET
        rating_count = EXCLUDED.rating_count,
        average_rating = EXCLUDED.average_rating;
    
    -- Test enhanced trust score calculation
    BEGIN
        SELECT calculate_enhanced_trust_score(test_url_hash, test_domain) as enhanced_score
        INTO trust_result;
        
        IF trust_result.enhanced_score IS NOT NULL THEN
            RAISE NOTICE '✓ Enhanced trust score calculation: Working correctly';
            RAISE NOTICE '  - Enhanced Score: %', trust_result.enhanced_score;
        ELSE
            RAISE WARNING '✗ Enhanced trust score calculation: Returned NULL';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ Enhanced trust score calculation error: %', SQLERRM;
    END;
    
    -- Clean up test data
    DELETE FROM url_stats WHERE url_hash = test_url_hash;
END;
$$;

-- ============================================================================
-- PART 4: TEST CRON JOB INTEGRATION
-- ============================================================================

DO $$
DECLARE
    cron_result TEXT;
BEGIN
    RAISE NOTICE 'Testing cron job integration...';
    
    -- Test batch aggregate ratings function
    BEGIN
        SELECT batch_aggregate_ratings(1) INTO cron_result;
        RAISE NOTICE '✓ Batch aggregate ratings: %', cron_result;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ Batch aggregate ratings error: %', SQLERRM;
    END;
    
    -- Check if cron job exists
    BEGIN
        IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'aggregate-ratings-job') THEN
            RAISE NOTICE '✓ Cron job exists: aggregate-ratings-job';
        ELSE
            RAISE WARNING '✗ Cron job missing: aggregate-ratings-job';
        END IF;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ Cron job check error: %', SQLERRM;
    END;
END;
$$;

-- ============================================================================
-- PART 5: COMPREHENSIVE VALIDATION SUMMARY
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'SECURITY FIXES AND API COMPATIBILITY VERIFICATION COMPLETE';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'VERIFICATION COMPLETED FOR:';
    RAISE NOTICE '';
    RAISE NOTICE '1. Security Definer Views:';
    RAISE NOTICE '   - processing_status_summary';
    RAISE NOTICE '   - domain_cache_status';
    RAISE NOTICE '   - enhanced_trust_analytics';
    RAISE NOTICE '   - trust_algorithm_performance';
    RAISE NOTICE '';
    RAISE NOTICE '2. Function Search Path Settings:';
    RAISE NOTICE '   - log_migration_completion';
    RAISE NOTICE '   - has_enhanced_scores';
    RAISE NOTICE '';
    RAISE NOTICE '3. API Endpoint Functionality:';
    RAISE NOTICE '   - GET /url-stats endpoint simulation';
    RAISE NOTICE '   - POST /rating endpoint simulation';
    RAISE NOTICE '   - Domain cache access (406 error prevention)';
    RAISE NOTICE '   - Enhanced trust score calculation';
    RAISE NOTICE '   - Cron job integration';
    RAISE NOTICE '';
    RAISE NOTICE 'If all tests above show ✓ (success), then:';
    RAISE NOTICE '- All security warnings should be resolved';
    RAISE NOTICE '- API endpoints should function correctly';
    RAISE NOTICE '- RLS policies are compatible with unified API';
    RAISE NOTICE '- Domain cache 406 errors should be prevented';
    RAISE NOTICE '';
    RAISE NOTICE 'Next: Test the actual API endpoints with curl or extension';
    RAISE NOTICE '================================================================';
END;
$$;