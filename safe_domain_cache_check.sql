-- Safe check without reading function definitions to avoid array_agg error

-- Just check table structures without touching functions
SELECT 'domain_cache structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'domain_cache' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 'domain_cache_status structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'domain_cache_status' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check sample data from both tables
SELECT 'Sample from domain_cache:' as info;
SELECT domain, created_at, expires_at
FROM domain_cache 
ORDER BY domain
LIMIT 3;

SELECT 'Sample from domain_cache_status:' as info;
SELECT domain, created_at, expires_at
FROM domain_cache_status 
ORDER BY domain
LIMIT 3;

-- List all function names without reading definitions
SELECT 'All functions (names only):' as info;
SELECT p.proname as function_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
ORDER BY p.proname;