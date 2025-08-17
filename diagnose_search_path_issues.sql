-- Diagnostic Script for Search Path Issues
-- Run this to understand why the security warnings persist

-- ============================================================================
-- DIAGNOSTIC 1: List all functions with their search_path configuration
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'ALL FUNCTIONS IN PUBLIC SCHEMA WITH SEARCH_PATH STATUS';
    RAISE NOTICE '================================================================';
    
    FOR func_record IN
        SELECT 
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            p.prosecdef,
            p.proconfig,
            CASE 
                WHEN p.proconfig IS NULL THEN 'NO CONFIG'
                WHEN 'search_path=public' = ANY(p.proconfig) THEN 'search_path=public'
                WHEN 'search_path=' = ANY(p.proconfig) THEN 'search_path=empty'
                ELSE 'OTHER CONFIG'
            END as search_path_status
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true  -- Only SECURITY DEFINER functions
        ORDER BY p.proname
    LOOP
        RAISE NOTICE 'Function: %(%)', func_record.proname, func_record.args;
        RAISE NOTICE '  Security: % | Config: % | Status: %', 
            CASE WHEN func_record.prosecdef THEN 'DEFINER' ELSE 'INVOKER' END,
            func_record.proconfig,
            func_record.search_path_status;
            
        -- Highlight problematic functions
        IF func_record.proname IN ('log_migration_completion', 'has_enhanced_scores') THEN
            IF func_record.search_path_status = 'NO CONFIG' THEN
                RAISE NOTICE '  ❌ PROBLEM: This function needs search_path configuration';
            ELSE
                RAISE NOTICE '  ✓ OK: This function has search_path configured';
            END IF;
        END IF;
        
        RAISE NOTICE '';
    END LOOP;
END;
$$;

-- ============================================================================
-- DIAGNOSTIC 2: Check for duplicate function definitions
-- ============================================================================

DO $$
DECLARE
    func_count RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'CHECKING FOR DUPLICATE FUNCTION DEFINITIONS';
    RAISE NOTICE '================================================================';
    
    -- Check log_migration_completion duplicates
    FOR func_count IN
        SELECT 
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            COUNT(*) OVER (PARTITION BY p.proname) as duplicate_count
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'log_migration_completion'
    LOOP
        RAISE NOTICE 'Function: %(%)', func_count.proname, func_count.args;
        RAISE NOTICE '  Total definitions with this name: %', func_count.duplicate_count;
        
        IF func_count.duplicate_count > 1 THEN
            RAISE NOTICE '  ⚠️  DUPLICATE DETECTED: This may cause linter to show multiple warnings';
        END IF;
    END LOOP;
    
    -- Check has_enhanced_scores duplicates
    FOR func_count IN
        SELECT 
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            COUNT(*) OVER (PARTITION BY p.proname) as duplicate_count
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname = 'has_enhanced_scores'
    LOOP
        RAISE NOTICE 'Function: %(%)', func_count.proname, func_count.args;
        RAISE NOTICE '  Total definitions with this name: %', func_count.duplicate_count;
        
        IF func_count.duplicate_count > 1 THEN
            RAISE NOTICE '  ⚠️  DUPLICATE DETECTED: This may cause linter to show multiple warnings';
        END IF;
    END LOOP;
END;
$$;

-- ============================================================================
-- DIAGNOSTIC 3: Show exact SQL to fix remaining issues
-- ============================================================================

DO $$
DECLARE
    func_record RECORD;
    fix_sql TEXT := '';
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'GENERATED SQL FIXES FOR REMAINING ISSUES';
    RAISE NOTICE '================================================================';
    
    FOR func_record IN
        SELECT 
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args,
            p.proconfig
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN ('log_migration_completion', 'has_enhanced_scores')
        AND p.prosecdef = true
        AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)))
    LOOP
        fix_sql := format('ALTER FUNCTION public.%I(%s) SET search_path = ''public'';', 
                         func_record.proname, 
                         func_record.args);
        
        RAISE NOTICE 'Fix needed for: %(%)', func_record.proname, func_record.args;
        RAISE NOTICE 'SQL: %', fix_sql;
        RAISE NOTICE '';
    END LOOP;
    
    IF fix_sql = '' THEN
        RAISE NOTICE 'No additional fixes needed - all functions have proper search_path';
    END IF;
END;
$$;

-- ============================================================================
-- DIAGNOSTIC 4: Check what Supabase linter might be seeing
-- ============================================================================

DO $$
DECLARE
    problematic_functions INTEGER := 0;
    func_record RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'SIMULATING SUPABASE LINTER CHECKS';
    RAISE NOTICE '================================================================';
    
    -- Count functions that would trigger the linter warning
    SELECT COUNT(*) INTO problematic_functions
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true  -- SECURITY DEFINER
    AND (p.proconfig IS NULL OR NOT (
        'search_path=public' = ANY(p.proconfig) OR
        'search_path=' = ANY(p.proconfig) OR
        'search_path=public,pg_temp' = ANY(p.proconfig)
    ));
    
    RAISE NOTICE 'Functions that would trigger "Function Search Path Mutable" warning: %', problematic_functions;
    
    -- List them specifically
    FOR func_record IN
        SELECT 
            p.proname,
            pg_get_function_identity_arguments(p.oid) as args
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true
        AND (p.proconfig IS NULL OR NOT (
            'search_path=public' = ANY(p.proconfig) OR
            'search_path=' = ANY(p.proconfig) OR
            'search_path=public,pg_temp' = ANY(p.proconfig)
        ))
        ORDER BY p.proname
    LOOP
        RAISE NOTICE '  - %(%)', func_record.proname, func_record.args;
    END LOOP;
    
    IF problematic_functions = 0 THEN
        RAISE NOTICE '🎉 SUCCESS: No functions should trigger search_path warnings';
    ELSE
        RAISE NOTICE '⚠️  WARNING: % functions still have search_path issues', problematic_functions;
    END IF;
    
    RAISE NOTICE '================================================================';
END;
$$;

-- ============================================================================
-- SUMMARY AND RECOMMENDATIONS
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'DIAGNOSTIC SUMMARY AND RECOMMENDATIONS';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'This diagnostic script checks:';
    RAISE NOTICE '1. All SECURITY DEFINER functions and their search_path status';
    RAISE NOTICE '2. Duplicate function definitions that might confuse the linter';
    RAISE NOTICE '3. Exact SQL needed to fix remaining issues';
    RAISE NOTICE '4. Simulation of what Supabase linter sees';
    RAISE NOTICE '';
    RAISE NOTICE 'If warnings persist after running the aggressive fix:';
    RAISE NOTICE '1. Check for duplicate function definitions';
    RAISE NOTICE '2. Ensure all function overloads have search_path set';
    RAISE NOTICE '3. Consider dropping and recreating functions completely';
    RAISE NOTICE '4. Verify Supabase linter cache is refreshed';
    RAISE NOTICE '';
    RAISE NOTICE 'The linter may take time to refresh - try waiting a few minutes';
    RAISE NOTICE 'and refreshing the Supabase dashboard.';
    RAISE NOTICE '================================================================';
END;
$$;