-- Fix for duplicate auto_generate_content_type_rules functions
-- This will drop ALL versions and let the migration recreate the correct one

-- Drop all versions of the function (handles overloaded functions)
DROP FUNCTION IF EXISTS auto_generate_content_type_rules();
DROP FUNCTION IF EXISTS auto_generate_content_type_rules(INTEGER);
DROP FUNCTION IF EXISTS auto_generate_content_type_rules(TEXT);

-- Also check for any other variations
DO $$
DECLARE
    func_record RECORD;
BEGIN
    FOR func_record IN 
        SELECT p.proname, p.oid
        FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public'
        AND p.proname LIKE '%auto_generate_content_type_rules%'
    LOOP
        EXECUTE 'DROP FUNCTION IF EXISTS ' || func_record.proname || '() CASCADE';
        RAISE NOTICE 'Dropped function: %', func_record.proname;
    END LOOP;
END $$;

-- Now test your table query
SELECT 'domain_cache' as table_name, COUNT(*) as row_count FROM domain_cache
UNION ALL
SELECT 'domain_cache_status', COUNT(*) FROM domain_cache_status;