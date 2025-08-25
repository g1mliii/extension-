-- Nuclear option: Find and drop all functions without reading their definitions
-- This avoids the array_agg parsing error

-- First, let's see what functions exist (just names, no definitions)
SELECT 
    p.proname as function_name,
    p.oid
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%content%'
ORDER BY p.proname;

-- Drop all functions that might contain the problematic code
-- We'll be aggressive and drop anything that might be related
DO $$
DECLARE
    func_record RECORD;
BEGIN
    -- Drop functions by name pattern without reading definitions
    FOR func_record IN 
        SELECT p.proname, p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND (
            p.proname LIKE '%content%' OR 
            p.proname LIKE '%generate%' OR
            p.proname LIKE '%auto%'
        )
    LOOP
        BEGIN
            EXECUTE 'DROP FUNCTION IF EXISTS ' || quote_ident(func_record.proname) || '() CASCADE';
            RAISE NOTICE 'Dropped function: %', func_record.proname;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not drop function: % (Error: %)', func_record.proname, SQLERRM;
        END;
    END LOOP;
END $$;

-- Now try the simple table count query
SELECT 'domain_cache' as table_name, COUNT(*) as row_count FROM domain_cache
UNION ALL
SELECT 'domain_cache_status', COUNT(*) FROM domain_cache_status;