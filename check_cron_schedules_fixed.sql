-- Check all cron jobs and their schedules to understand timing dependencies

SELECT 'Current cron jobs and schedules:' as info;
SELECT 
    jobname,
    schedule,
    command,
    active,
    CASE 
        WHEN command LIKE '%auto_generate_content_type_rules%' THEN 'CONTENT RULES'
        WHEN command LIKE '%cleanup%' OR command LIKE '%delete%' THEN 'CLEANUP'
        WHEN command LIKE '%aggregate%' THEN 'AGGREGATION'
        WHEN command LIKE '%domain_analysis%' THEN 'DOMAIN ANALYSIS'
        ELSE 'OTHER'
    END as job_type
FROM cron.job
ORDER BY 
    CASE 
        WHEN command LIKE '%auto_generate_content_type_rules%' THEN 1
        WHEN command LIKE '%aggregate%' THEN 2
        WHEN command LIKE '%cleanup%' THEN 3
        ELSE 4
    END,
    schedule;

-- Let's also create some test ratings to verify the function works with real data
SELECT 'Creating test ratings for content rule generation:' as info;

-- Insert test ratings for a new domain to see if it gets detected
INSERT INTO ratings (url_hash, user_id_hash, rating, url, domain, is_spam, is_misleading, is_scam, created_at)
VALUES 
    (md5('https://example-news.com/article1'), gen_random_uuid(), 4, 'https://example-news.com/article1', 'example-news.com', false, false, false, NOW() - INTERVAL '1 day'),
    (md5('https://example-news.com/article2'), gen_random_uuid(), 5, 'https://example-news.com/article2', 'example-news.com', false, false, false, NOW() - INTERVAL '2 days'),
    (md5('https://example-news.com/article3'), gen_random_uuid(), 3, 'https://example-news.com/article3', 'example-news.com', false, false, false, NOW() - INTERVAL '3 days'),
    (md5('https://example-news.com/article4'), gen_random_uuid(), 4, 'https://example-news.com/article4', 'example-news.com', false, false, false, NOW() - INTERVAL '4 days');

-- Test with a spam domain
INSERT INTO ratings (url_hash, user_id_hash, rating, url, domain, is_spam, is_misleading, is_scam, created_at)
VALUES 
    (md5('https://spam-site.com/page1'), gen_random_uuid(), 1, 'https://spam-site.com/page1', 'spam-site.com', true, false, false, NOW() - INTERVAL '1 day'),
    (md5('https://spam-site.com/page2'), gen_random_uuid(), 2, 'https://spam-site.com/page2', 'spam-site.com', true, true, false, NOW() - INTERVAL '2 days'),
    (md5('https://spam-site.com/page3'), gen_random_uuid(), 1, 'https://spam-site.com/page3', 'spam-site.com', true, false, true, NOW() - INTERVAL '3 days');