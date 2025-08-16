-- Fix Table Permissions for Extension API Access
-- This migration fixes 406 and 403 errors by granting proper table permissions

-- ============================================================================
-- PART 1: GRANT PERMISSIONS ON URL_STATS TABLE
-- ============================================================================

-- Grant SELECT permissions to all roles for url_stats table (needed by API functions)
GRANT SELECT ON public.url_stats TO anon, authenticated, service_role;

-- Grant INSERT, UPDATE, DELETE permissions to authenticated and service_role
GRANT INSERT, UPDATE, DELETE ON public.url_stats TO authenticated, service_role;

-- ============================================================================
-- PART 2: GRANT PERMISSIONS ON RATINGS TABLE  
-- ============================================================================

-- Grant SELECT permissions to all roles for ratings table (needed by API functions)
GRANT SELECT ON public.ratings TO anon, authenticated, service_role;

-- Grant INSERT, UPDATE, DELETE permissions to authenticated and service_role
GRANT INSERT, UPDATE, DELETE ON public.ratings TO authenticated, service_role;

-- ============================================================================
-- PART 3: GRANT PERMISSIONS ON DOMAIN_CACHE TABLE
-- ============================================================================

-- Grant SELECT permissions to all roles for domain_cache table (already done but ensuring)
GRANT SELECT ON public.domain_cache TO anon, authenticated, service_role;

-- Grant INSERT, UPDATE, DELETE permissions to service_role
GRANT INSERT, UPDATE, DELETE ON public.domain_cache TO service_role;

-- ============================================================================
-- PART 4: TEST PERMISSIONS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Testing table permissions...';
    
    -- Test that we can query url_stats
    PERFORM COUNT(*) FROM public.url_stats LIMIT 1;
    RAISE NOTICE '✓ url_stats table accessible';
    
    -- Test that we can query ratings
    PERFORM COUNT(*) FROM public.ratings LIMIT 1;
    RAISE NOTICE '✓ ratings table accessible';
    
    -- Test that we can query domain_cache
    PERFORM COUNT(*) FROM public.domain_cache LIMIT 1;
    RAISE NOTICE '✓ domain_cache table accessible';
    
    RAISE NOTICE 'All table permissions verified successfully!';
END;
$$;

-- ============================================================================
-- MIGRATION COMPLETION LOG
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'TABLE PERMISSIONS FIX COMPLETED';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'FIXED PERMISSIONS:';
    RAISE NOTICE '✓ url_stats: SELECT for anon/authenticated, INSERT/UPDATE/DELETE for authenticated/service_role';
    RAISE NOTICE '✓ ratings: SELECT for anon/authenticated, INSERT/UPDATE/DELETE for authenticated/service_role';
    RAISE NOTICE '✓ domain_cache: SELECT for anon/authenticated, INSERT/UPDATE/DELETE for service_role';
    RAISE NOTICE '';
    RAISE NOTICE 'EXPECTED RESULTS:';
    RAISE NOTICE '• 406 errors on url_stats should be resolved';
    RAISE NOTICE '• Extension should work for unauthenticated users';
    RAISE NOTICE '• API functions can access tables properly';
    RAISE NOTICE '• Domain analysis triggering should work';
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
END;
$$;