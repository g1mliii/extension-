-- Just check table structures first to see what columns exist

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