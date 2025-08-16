-- Fix Domain Cache 406 Errors and Population Issues
-- This migration addresses the root causes of 406 errors and domain cache population failures

-- ============================================================================
-- PART 1: ENSURE DOMAIN_CACHE TABLE HAS PROPER STRUCTURE AND CONSTRAINTS
-- ============================================================================

-- Ensure domain_cache table exists with all required columns
CREATE TABLE IF NOT EXISTS public.domain_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  domain_age_days INTEGER,
  whois_data JSONB,
  http_status INTEGER,
  ssl_valid BOOLEAN,
  google_safe_browsing_status TEXT,
  hybrid_analysis_status TEXT,
  threat_score INTEGER,
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cache_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure proper indexes exist for performance
CREATE INDEX IF NOT EXISTS idx_domain_cache_domain ON public.domain_cache(domain);
CREATE INDEX IF NOT EXISTS idx_domain_cache_expires ON public.domain_cache(cache_expires_at);
CREATE INDEX IF NOT EXISTS idx_domain_cache_last_checked ON public.domain_cache(last_checked);

-- ============================================================================
-- PART 2: FIX PERMISSIONS AND GRANTS FOR DOMAIN_CACHE ACCESS
-- ============================================================================

-- Grant proper permissions to all roles
GRANT SELECT ON public.domain_cache TO anon, authenticated, service_role;
GRANT INSERT, UPDATE ON public.domain_cache TO authenticated, service_role;
GRANT DELETE ON public.domain_cache TO service_role;

-- Ensure RLS is disabled (already done in previous migration but double-check)
ALTER TABLE public.domain_cache DISABLE ROW LEVEL SECURITY;

-- ============================================================================
-- PART 3: CREATE HELPER FUNCTIONS TO AVOID 406 ERRORS
-- ============================================================================

-- Function to safely check if domain exists in cache
CREATE OR REPLACE FUNCTION check_domain_cache_exists(p_domain TEXT)
RETURNS TABLE(
    domain_exists BOOLEAN,
    cache_valid BOOLEAN,
    expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
    RETURN QUERY
    SELECT 
        EXISTS(SELECT 1 FROM domain_cache WHERE domain = p_domain) as domain_exists,
        EXISTS(SELECT 1 FROM domain_cache WHERE domain = p_domain AND cache_expires_at > NOW()) as cache_valid,
        (SELECT cache_expires_at FROM domain_cache WHERE domain = p_domain LIMIT 1) as expires_at;
END;
$;

-- Function to safely get domain cache data
CREATE OR REPLACE FUNCTION get_domain_cache_safe(p_domain TEXT)
RETURNS TABLE(
    domain TEXT,
    domain_age_days INTEGER,
    ssl_valid BOOLEAN,
    google_safe_browsing_status TEXT,
    hybrid_analysis_status TEXT,
    threat_score INTEGER,
    last_checked TIMESTAMP WITH TIME ZONE,
    cache_expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
    RETURN QUERY
    SELECT 
        dc.domain,
        dc.domain_age_days,
        dc.ssl_valid,
        dc.google_safe_browsing_status,
        dc.hybrid_analysis_status,
        dc.threat_score,
        dc.last_checked,
        dc.cache_expires_at
    FROM domain_cache dc
    WHERE dc.domain = p_domain
    LIMIT 1;
END;
$;

-- Function to safely insert or update domain cache
CREATE OR REPLACE FUNCTION upsert_domain_cache_safe(
    p_domain TEXT,
    p_domain_age_days INTEGER DEFAULT NULL,
    p_whois_data JSONB DEFAULT NULL,
    p_http_status INTEGER DEFAULT NULL,
    p_ssl_valid BOOLEAN DEFAULT NULL,
    p_google_safe_browsing_status TEXT DEFAULT NULL,
    p_hybrid_analysis_status TEXT DEFAULT NULL,
    p_threat_score INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    cache_expires TIMESTAMP WITH TIME ZONE := NOW() + INTERVAL '7 days';
BEGIN
    -- Try to insert first
    BEGIN
        INSERT INTO domain_cache (
            domain,
            domain_age_days,
            whois_data,
            http_status,
            ssl_valid,
            google_safe_browsing_status,
            hybrid_analysis_status,
            threat_score,
            last_checked,
            cache_expires_at
        ) VALUES (
            p_domain,
            p_domain_age_days,
            p_whois_data,
            p_http_status,
            p_ssl_valid,
            p_google_safe_browsing_status,
            p_hybrid_analysis_status,
            p_threat_score,
            NOW(),
            cache_expires
        );
        
        RETURN TRUE;
        
    EXCEPTION WHEN unique_violation THEN
        -- Domain already exists, update it
        UPDATE domain_cache SET
            domain_age_days = COALESCE(p_domain_age_days, domain_age_days),
            whois_data = COALESCE(p_whois_data, whois_data),
            http_status = COALESCE(p_http_status, http_status),
            ssl_valid = COALESCE(p_ssl_valid, ssl_valid),
            google_safe_browsing_status = COALESCE(p_google_safe_browsing_status, google_safe_browsing_status),
            hybrid_analysis_status = COALESCE(p_hybrid_analysis_status, hybrid_analysis_status),
            threat_score = COALESCE(p_threat_score, threat_score),
            last_checked = NOW(),
            cache_expires_at = cache_expires
        WHERE domain = p_domain;
        
        RETURN TRUE;
    END;
END;
$;

-- ============================================================================
-- PART 4: GRANT EXECUTE PERMISSIONS ON NEW FUNCTIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION check_domain_cache_exists(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_domain_cache_safe(TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION upsert_domain_cache_safe(TEXT, INTEGER, JSONB, INTEGER, BOOLEAN, TEXT, TEXT, INTEGER) TO authenticated, service_role;

-- ============================================================================
-- PART 5: CREATE MONITORING VIEW FOR DOMAIN CACHE STATUS
-- ============================================================================

CREATE OR REPLACE VIEW domain_cache_status AS
SELECT 
    COUNT(*) as total_domains,
    COUNT(*) FILTER (WHERE cache_expires_at > NOW()) as valid_cache_count,
    COUNT(*) FILTER (WHERE cache_expires_at <= NOW()) as expired_cache_count,
    COUNT(*) FILTER (WHERE ssl_valid = true) as ssl_valid_count,
    COUNT(*) FILTER (WHERE threat_score > 50) as high_threat_count,
    ROUND(AVG(threat_score), 2) as avg_threat_score,
    MIN(last_checked) as oldest_check,
    MAX(last_checked) as newest_check
FROM domain_cache;

GRANT SELECT ON domain_cache_status TO anon, authenticated, service_role;

-- ============================================================================
-- PART 6: TEST THE NEW FUNCTIONS TO ENSURE THEY WORK
-- ============================================================================

DO $
DECLARE
    test_domain TEXT := 'test-domain-' || extract(epoch from now())::text || '.com';
    cache_check RECORD;
    upsert_result BOOLEAN;
BEGIN
    RAISE NOTICE 'Testing domain cache functions with domain: %', test_domain;
    
    -- Test 1: Check non-existent domain
    SELECT * INTO cache_check FROM check_domain_cache_exists(test_domain);
    IF cache_check.domain_exists THEN
        RAISE EXCEPTION 'Test failed: Domain should not exist yet';
    END IF;
    RAISE NOTICE 'Test 1 passed: Non-existent domain check works';
    
    -- Test 2: Insert domain cache entry
    SELECT upsert_domain_cache_safe(
        test_domain,
        365,
        '{"test": true}'::jsonb,
        200,
        true,
        'safe',
        'clean',
        10
    ) INTO upsert_result;
    
    IF NOT upsert_result THEN
        RAISE EXCEPTION 'Test failed: Domain cache upsert failed';
    END IF;
    RAISE NOTICE 'Test 2 passed: Domain cache upsert works';
    
    -- Test 3: Check domain now exists
    SELECT * INTO cache_check FROM check_domain_cache_exists(test_domain);
    IF NOT cache_check.domain_exists OR NOT cache_check.cache_valid THEN
        RAISE EXCEPTION 'Test failed: Domain should exist and be valid';
    END IF;
    RAISE NOTICE 'Test 3 passed: Domain exists and cache is valid';
    
    -- Test 4: Get domain cache data
    DECLARE
        cache_data RECORD;
    BEGIN
        SELECT * INTO cache_data FROM get_domain_cache_safe(test_domain);
        IF cache_data.domain IS NULL THEN
            RAISE EXCEPTION 'Test failed: Could not retrieve domain cache data';
        END IF;
        RAISE NOTICE 'Test 4 passed: Domain cache retrieval works';
    END;
    
    -- Clean up test data
    DELETE FROM domain_cache WHERE domain = test_domain;
    
    RAISE NOTICE 'All domain cache function tests passed!';
END;
$;

-- ============================================================================
-- PART 7: ADD COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION check_domain_cache_exists IS 'Safely check if domain exists in cache without causing 406 errors';
COMMENT ON FUNCTION get_domain_cache_safe IS 'Safely retrieve domain cache data without causing 406 errors';
COMMENT ON FUNCTION upsert_domain_cache_safe IS 'Safely insert or update domain cache entry with proper conflict handling';
COMMENT ON VIEW domain_cache_status IS 'Monitoring view for domain cache health and statistics';

-- ============================================================================
-- MIGRATION COMPLETION LOG
-- ============================================================================

DO $
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'DOMAIN CACHE 406 ERROR FIX MIGRATION COMPLETED';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'COMPLETED TASKS:';
    RAISE NOTICE '✓ Ensured domain_cache table structure and constraints';
    RAISE NOTICE '✓ Fixed permissions and grants for domain_cache access';
    RAISE NOTICE '✓ Created helper functions to avoid 406 errors';
    RAISE NOTICE '✓ Added safe domain cache check and upsert functions';
    RAISE NOTICE '✓ Created monitoring view for domain cache status';
    RAISE NOTICE '✓ Tested all new functions successfully';
    RAISE NOTICE '';
    RAISE NOTICE 'NEW FUNCTIONS AVAILABLE:';
    RAISE NOTICE '• check_domain_cache_exists(domain) - Check if domain exists without 406 errors';
    RAISE NOTICE '• get_domain_cache_safe(domain) - Get domain cache data safely';
    RAISE NOTICE '• upsert_domain_cache_safe(...) - Insert/update domain cache safely';
    RAISE NOTICE '';
    RAISE NOTICE 'NEXT STEPS:';
    RAISE NOTICE '1. Update API functions to use new safe functions';
    RAISE NOTICE '2. Test domain cache population with rating submissions';
    RAISE NOTICE '3. Monitor domain_cache_status view for health metrics';
    RAISE NOTICE '4. Verify 406 errors are eliminated';
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
END;
$;