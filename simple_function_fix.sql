-- Simple fix: Just drop and recreate the problematic function
DROP FUNCTION IF EXISTS auto_generate_content_type_rules();

-- Test query to check which tables exist
SELECT 'domain_cache' as table_name, COUNT(*) as row_count FROM domain_cache
UNION ALL
SELECT 'domain_cache_status', COUNT(*) FROM domain_cache_status;