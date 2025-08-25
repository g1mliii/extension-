-- Test which table has which columns by trying to select from each

-- Test domain_cache
SELECT 'Testing domain_cache:' as info;
SELECT domain, created_at FROM domain_cache LIMIT 1;

-- Test domain_cache_status  
SELECT 'Testing domain_cache_status:' as info;
SELECT domain, created_at FROM domain_cache_status LIMIT 1;

-- Try cache_status column on domain_cache
SELECT 'Testing cache_status on domain_cache:' as info;
SELECT domain, cache_status FROM domain_cache LIMIT 1;

-- Try cache_status column on domain_cache_status
SELECT 'Testing cache_status on domain_cache_status:' as info;
SELECT domain, cache_status FROM domain_cache_status LIMIT 1;