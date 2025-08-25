-- Now that we've cleared the problematic functions, let's check domain cache usage

-- Check if domain_cache_status is referenced in any remaining functions
SELECT 'Functions using domain_cache_status:' as info;

SELECT p.proname as function_name,
       CASE 
           WHEN pg_get_functiondef(p.oid) LIKE '%domain_cache_status%' THEN 'Uses domain_cache_status'
           WHEN pg_get_functiondef(p.oid) LIKE '%domain_cache%' THEN 'Uses domain_cache (not status)'
           ELSE 'Other'
       END as cache_usage
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND (pg_get_functiondef(p.oid) LIKE '%domain_cache%')
ORDER BY p.proname;

-- Check the structure of both tables to see if they're identical
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

-- Check if the data is identical
SELECT 'Data comparison:' as info;
SELECT 
    'domain_cache' as table_name,
    domain,
    created_at,
    expires_at
FROM domain_cache 
ORDER BY domain
LIMIT 5;

SELECT 
    'domain_cache_status' as table_name,
    domain,
    created_at,
    expires_at
FROM domain_cache_status 
ORDER BY domain
LIMIT 5;