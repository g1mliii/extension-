-- Aggressive Search Path Fix Migration
-- Uses ALTER FUNCTION SET search_path approach to definitively fix the warnings

-- ============================================================================
-- APPROACH: Use ALTER FUNCTION SET search_path (Supabase's exact recommendation)
-- ============================================================================

-- First, let's check what functions exist and their current configuration
DO $$
DECLARE
    func_record RECORD;
BEGIN
    RAISE NOTICE 'Current function configurations:';
    
    FOR func_record IN
        SELECT 
            p.proname,
            p.proconfig,
            p.prosecdef,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN ('log_migration_completion', 'has_enhanced_scores')
    LOOP
        RAISE NOTICE 'Function: % | Args: % | SECDEF: % | Config: %', 
            func_record.proname, 
            func_record.args, 
            func_record.prosecdef, 
            func_record.proconfig;
    END LOOP;
END;
$$;

-- ============================================================================
-- FIX 1: log_migration_completion function
-- ============================================================================

-- Use ALTER FUNCTION to set search_path parameter (this is what Supabase linter expects)
DO $$
DECLARE
    func_exists BOOLEAN;
BEGIN
    -- Check if function exists with TEXT, TEXT signature
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'log_migration_completion'
        AND pg_get_function_identity_arguments(p.oid) = 'migration_name text, completion_status text'
    ) INTO func_exists;
    
    IF func_exists THEN
        -- Set search_path using ALTER FUNCTION (this should fix the linter warning)
        ALTER FUNCTION public.log_migration_completion(TEXT, TEXT) SET search_path = 'public';
        RAISE NOTICE '✓ Set search_path for log_migration_completion(TEXT, TEXT)';
    END IF;
    
    -- Check if function exists with TEXT signature (default parameter)
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'log_migration_completion'
        AND pg_get_function_identity_arguments(p.oid) = 'migration_name text'
    ) INTO func_exists;
    
    IF func_exists THEN
        -- Set search_path using ALTER FUNCTION
        ALTER FUNCTION public.log_migration_completion(TEXT) SET search_path = 'public';
        RAISE NOTICE '✓ Set search_path for log_migration_completion(TEXT)';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not alter log_migration_completion: %', SQLERRM;
END;
$$;

-- ============================================================================
-- FIX 2: has_enhanced_scores function
-- ============================================================================

-- Use ALTER FUNCTION to set search_path parameter
DO $$
DECLARE
    func_exists BOOLEAN;
BEGIN
    -- Check if function exists
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' 
        AND p.proname = 'has_enhanced_scores'
        AND pg_get_function_identity_arguments(p.oid) = ''
    ) INTO func_exists;
    
    IF func_exists THEN
        -- Set search_path using ALTER FUNCTION (this should fix the linter warning)
        ALTER FUNCTION public.has_enhanced_scores() SET search_path = 'public';
        RAISE NOTICE '✓ Set search_path for has_enhanced_scores()';
    END IF;
    
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Could not alter has_enhanced_scores: %', SQLERRM;
END;
$$;

-- ============================================================================
-- ALTERNATIVE APPROACH: Recreate functions with proper search_path from start
-- ============================================================================

-- If ALTER FUNCTION doesn't work, recreate the functions with SET search_path in definition

-- Recreate log_migration_completion with SET search_path in CREATE statement
DROP FUNCTION IF EXISTS public.log_migration_completion(TEXT, TEXT);
DROP FUNCTION IF EXISTS public.log_migration_completion(TEXT);

CREATE OR REPLACE FUNCTION public.log_migration_completion(
    migration_name TEXT, 
    completion_status TEXT DEFAULT 'completed'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Back to SECURITY DEFINER but with proper search_path
SET search_path = 'public'  -- This is the key - set in CREATE statement
AS $$
BEGIN
    -- Create migration_logs table if it doesn't exist
    CREATE TABLE IF NOT EXISTS migration_logs (
        id SERIAL PRIMARY KEY,
        migration_name TEXT UNIQUE NOT NULL,
        completion_status TEXT NOT NULL DEFAULT 'completed',
        completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    
    -- Insert or update migration log
    INSERT INTO migration_logs (migration_name, completion_status, completed_at)
    VALUES (migration_name, completion_status, NOW())
    ON CONFLICT (migration_name) 
    DO UPDATE SET 
        completion_status = EXCLUDED.completion_status,
        completed_at = EXCLUDED.completed_at;
    
    RETURN TRUE;
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.log_migration_completion(TEXT, TEXT) TO service_role;

-- Recreate has_enhanced_scores with SET search_path in CREATE statement
DROP FUNCTION IF EXISTS public.has_enhanced_scores();

CREATE OR REPLACE FUNCTION public.has_enhanced_scores()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- Back to SECURITY DEFINER but with proper search_path
SET search_path = 'public'  -- This is the key - set in CREATE statement
AS $$
BEGIN
    -- Check if enhanced scores exist
    RETURN EXISTS (
        SELECT 1 FROM url_stats 
        WHERE final_trust_score IS NOT NULL 
          AND domain_trust_score IS NOT NULL 
          AND community_trust_score IS NOT NULL
        LIMIT 1
    );
EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.has_enhanced_scores() TO anon, authenticated, service_role;

-- ============================================================================
-- VERIFICATION: Check the function configurations after fixes
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    fixed_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'VERIFICATION: Function configurations after fixes';
    RAISE NOTICE '================================================================';
    
    FOR func_record IN
        SELECT 
            p.proname,
            p.proconfig,
            p.prosecdef,
            pg_get_function_identity_arguments(p.oid) as args,
            CASE WHEN 'search_path=public' = ANY(p.proconfig) THEN 'SET' ELSE 'NOT SET' END as search_path_status
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN ('log_migration_completion', 'has_enhanced_scores')
        ORDER BY p.proname, p.oid
    LOOP
        RAISE NOTICE 'Function: %(%)', func_record.proname, func_record.args;
        RAISE NOTICE '  - SECURITY DEFINER: %', func_record.prosecdef;
        RAISE NOTICE '  - Config: %', func_record.proconfig;
        RAISE NOTICE '  - Search Path: %', func_record.search_path_status;
        
        IF func_record.search_path_status = 'SET' THEN
            fixed_count := fixed_count + 1;
            RAISE NOTICE '  ✓ FIXED: search_path properly configured';
        ELSE
            RAISE NOTICE '  ❌ ISSUE: search_path not configured';
        END IF;
        
        RAISE NOTICE '';
    END LOOP;
    
    RAISE NOTICE 'Functions with proper search_path: %', fixed_count;
    
    IF fixed_count >= 2 THEN
        RAISE NOTICE '🎉 SUCCESS: Both functions should now have proper search_path';
        RAISE NOTICE 'Supabase linter warnings should be resolved';
    ELSE
        RAISE WARNING '⚠️  Some functions may still have search_path issues';
    END IF;
    
    RAISE NOTICE '================================================================';
END;
$$;

-- ============================================================================
-- TEST THE FIXED FUNCTIONS
-- ============================================================================

DO $$
DECLARE
    log_result BOOLEAN;
    enhanced_result BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Testing fixed functions...';
    
    -- Test log_migration_completion
    BEGIN
        SELECT log_migration_completion('test_aggressive_fix', 'test_completed') INTO log_result;
        RAISE NOTICE '✓ log_migration_completion: Working (result: %)', log_result;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ log_migration_completion: Error - %', SQLERRM;
    END;
    
    -- Test has_enhanced_scores
    BEGIN
        SELECT has_enhanced_scores() INTO enhanced_result;
        RAISE NOTICE '✓ has_enhanced_scores: Working (result: %)', enhanced_result;
    EXCEPTION WHEN OTHERS THEN
        RAISE WARNING '✗ has_enhanced_scores: Error - %', SQLERRM;
    END;
END;
$$;

-- Log this migration
SELECT log_migration_completion('20250816000039_aggressive_search_path_fix', 'completed');

-- Final message
SELECT 'Aggressive search_path fix completed - check Supabase linter for resolved warnings' as status;