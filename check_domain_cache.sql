-- Check what's currently in domain_cache
SELECT 'Current domain_cache contents:' as info;

SELECT domain, domain_age_days, ssl_valid, http_status, created_at, expires_at
FROM domain_cache 
ORDER BY created_at DESC;

-- Check if any of the domains from url_stats are cached
SELECT 'Domains from url_stats that are cached:' as info;

SELECT DISTINCT us.domain, dc.domain_age_days, dc.ssl_valid, dc.http_status
FROM url_stats us
LEFT JOIN domain_cache dc ON us.domain = dc.domain
WHERE us.domain IS NOT NULL 
AND us.domain != 'unknown'
ORDER BY us.domain;