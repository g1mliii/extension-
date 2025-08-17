-- Investigation Script for Persistent Security Warnings
-- This script will help identify exactly what's causing the remaining warnings

-- ============================================================================
-- PART 1: INVESTIGATE SECURITY DEFINER VIEWS
-- ============================================================================

-- Check current view definitions to see if SECURITY DEFINER is still present
DO $$
DECLARE
    view_info RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'INVESTIGATING SECURITY DEFINER VIEWS';
    RAISE NOTICE '================================================================';
    
    FOR view_info IN 
        SELECT schemaname, viewname, definition
        FROM pg_views 
        WHERE schemaname = 'public' 
        AND viewname IN ('processing_status_summary', 'domain_cache_status', 'enhanced_trust_analytics', 'trust_algorithm_performance')
        ORDER BY viewname
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE 'View: %.%', view_info.schemaname, view_info.viewname;
        RAISE NOTICE 'Definition: %', SUBSTRING(view_info.definition FROM 1 FOR 200) || '...';
        
        IF view_info.definition ILIKE '%SECURITY DEFINER%' THEN
            RAISE NOTICE '❌ SECURITY DEFINER found in view definition';
        ELSE
            RAISE NOTICE '✅ No SECURITY DEFINER found in view definition';
        END IF;
    END LOOP;
END;
$$;

-- Check pg_class for view security settings
DO $$
DECLARE
    view_security RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Checking pg_class for view security settings...';
    
    FOR view_security IN
        SELECT c.relname, c.relkind, c.relacl
        FROM pg_class c
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE n.nspname = 'public'
        AND c.relname IN ('processing_status_summary', 'domain_cache_status', 'enhanced_trust_analytics', 'trust_algorithm_performance')
        AND c.relkind = 'v'
    LOOP
        RAISE NOTICE 'View: % | Kind: % | ACL: %', view_security.relname, view_security.relkind, view_security.relacl;
    END LOOP;
END;
$$;

-- ============================================================================
-- PART 2: INVESTIGATE FUNCTION SEARCH PATH WARNINGS
-- ============================================================================

-- Check current function configurations
DO $$
DECLARE
    func_info RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'INVESTIGATING FUNCTION SEARCH PATH SETTINGS';
    RAISE NOTICE '================================================================';
    
    FOR func_info IN
        SELECT 
            p.proname,
            p.proconfig,
            CASE WHEN 'search_path=public' = ANY(p.proconfig) THEN 'SET' ELSE 'NOT SET' END as search_path_status
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname IN ('log_migration_completion', 'has_enhanced_scores')
    LOOP
        RAISE NOTICE '';
        RAISE NOTICE 'Function: %', func_info.proname;
        RAISE NOTICE 'Config: %', func_info.proconfig;
        RAISE NOTICE 'Search Path Status: %', func_info.search_path_status;
        
        IF func_info.search_path_status = 'SET' THEN
            RAISE NOTICE '✅ Search path properly configured';
        ELSE
            RAISE NOTICE '❌ Search path NOT configured';
        END IF;
    END LOOP;
END;
$$;

-- List ALL functions that might have search path issues
DO $$
DECLARE
    func_info RECORD;
    functions_without_search_path TEXT[] := ARRAY[]::TEXT[];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Checking ALL functions for search path configuration...';
    
    FOR func_info IN
        SELECT 
            p.proname,
            p.proconfig,
            CASE WHEN p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)) THEN 'MISSING' ELSE 'SET' END as search_path_status
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true  -- Only SECURITY DEFINER functions
        ORDER BY p.proname
    LOOP
        IF func_info.search_path_status = 'MISSING' THEN
            functions_without_search_path := array_append(functions_without_search_path, func_info.proname);
        END IF;
    END LOOP;
    
    IF array_length(functions_without_search_path, 1) > 0 THEN
        RAISE NOTICE '';
        RAISE NOTICE '❌ Functions WITHOUT proper search_path:';
        RAISE NOTICE '%', array_to_string(functions_without_search_path, ', ');
    ELSE
        RAISE NOTICE '✅ All SECURITY DEFINER functions have proper search_path';
    END IF;
END;
$$;

-- ============================================================================
-- PART 3: CHECK FOR OTHER POTENTIAL SECURITY ISSUES
-- ============================================================================

-- Check for any remaining SECURITY DEFINER objects
DO $$
DECLARE
    security_definer_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'CHECKING FOR ALL SECURITY DEFINER OBJECTS';
    RAISE NOTICE '================================================================';
    
    -- Count SECURITY DEFINER functions
    SELECT COUNT(*) INTO security_definer_count
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
    AND p.prosecdef = true;
    
    RAISE NOTICE 'Total SECURITY DEFINER functions in public schema: %', security_definer_count;
    
    -- List them
    FOR func_info IN
        SELECT p.proname, p.proconfig
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true
        ORDER BY p.proname
    LOOP
        RAISE NOTICE 'SECURITY DEFINER function: % (config: %)', func_info.proname, func_info.proconfig;
    END LOOP;
END;
$$;

-- ============================================================================
-- PART 4: GENERATE SPECIFIC FIXES
-- ============================================================================

-- Generate the exact SQL needed to fix remaining issues
DO $$
DECLARE
    func_name TEXT;
    fix_sql TEXT := '';
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'GENERATING SPECIFIC FIXES FOR REMAINING ISSUES';
    RAISE NOTICE '================================================================';
    
    -- Generate fixes for functions without search_path
    FOR func_name IN
        SELECT p.proname
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.prosecdef = true
        AND (p.proconfig IS NULL OR NOT ('search_path=public' = ANY(p.proconfig)))
        ORDER BY p.proname
    LOOP
        fix_sql := fix_sql || 'ALTER FUNCTION public.' || func_name || '() SET search_path = public;' || E'\n';
    END LOOP;
    
    IF fix_sql != '' THEN
        RAISE NOTICE '';
        RAISE NOTICE 'SQL to fix function search_path issues:';
        RAISE NOTICE '%', fix_sql;
    ELSE
        RAISE NOTICE 'No function search_path fixes needed';
    END IF;
END;
$$;

-- Check if views might be created with SECURITY DEFINER due to underlying functions
DO $$
DECLARE
    view_name TEXT;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE 'Checking if views depend on SECURITY DEFINER functions...';
    
    FOR view_name IN VALUES ('processing_status_summary'), ('domain_cache_status'), ('enhanced_trust_analytics'), ('trust_algorithm_performance')
    LOOP
        BEGIN
            EXECUTE 'EXPLAIN (FORMAT TEXT) SELECT * FROM ' || view_name || ' LIMIT 1';
            RAISE NOTICE 'View % can be queried successfully', view_name;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'View % has issues: %', view_name, SQLERRM;
        END;
    END LOOP;
END;
$$;

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '================================================================';
    RAISE NOTICE 'INVESTIGATION COMPLETE';
    RAISE NOTICE '================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'This investigation will help identify:';
    RAISE NOTICE '1. Which views still have SECURITY DEFINER (if any)';
    RAISE NOTICE '2. Which functions are missing search_path configuration';
    RAISE NOTICE '3. All SECURITY DEFINER objects in the public schema';
    RAISE NOTICE '4. Specific SQL fixes needed';
    RAISE NOTICE '';
    RAISE NOTICE 'Review the output above to determine the exact fixes needed.';
    RAISE NOTICE '================================================================';
END;
$$;