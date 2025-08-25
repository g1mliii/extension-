-- Check both table structures separately to see the difference

SELECT 'domain_cache columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'domain_cache' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT '---separator---' as info;

SELECT 'domain_cache_status columns:' as info;
SELECT column_name, data_type
FROM information_schema.columns 
WHERE table_name = 'domain_cache_status' 
AND table_schema = 'public'
ORDER BY ordinal_position;