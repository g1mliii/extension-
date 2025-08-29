-- Compare the two domain cache tables with correct column names

-- Sample data from domain_cache
SELECT 'Sample from domain_cache:' as info;
SELECT domain, cache_expires_at, cache_status, created_at
FROM domain_cache 
ORDER BY domain
LIMIT 5;

-- Sample data from domain_cache_status  
SELECT 'Sample from domain_cache_status:' as info;
SELECT domain, cache_expires_at, cache_status, created_at
FROM domain_cache_status 
ORDER BY domain
LIMIT 5;

-- Check if the data is identical between tables
SELECT 'Data comparison - domains in both tables:' as info;
SELECT 
    dc.domain,
    dc.cache_status as cache_status,
    dcs.cache_status as status_cache_status,
    CASE 
        WHEN dc.cache_status = dcs.cache_status THEN 'SAME'
        ELSE 'DIFFERENT'
    END as status_match
FROM domain_cache dc
INNER JOIN domain_cache_status dcs ON dc.domain = dcs.domain
ORDER BY dc.domain
LIMIT 10;

-- Count differences
SELECT 'Summary:' as info;
SELECT 
    COUNT(*) as total_matches,
    COUNT(CASE WHEN dc.cache_status = dcs.cache_status THEN 1 END) as identical_status,
    COUNT(CASE WHEN dc.cache_status != dcs.cache_status THEN 1 END) as different_status
FROM domain_cache dc
INNER JOIN domain_cache_status dcs ON dc.domain = dcs.domain;