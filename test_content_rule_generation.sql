-- Test script for content type rule generation
-- This creates test ratings for a new domain and tests the auto-generation

-- Step 1: Create test ratings for a domain that doesn't have content type rules yet
-- Let's use 'example-blog.com' as our test domain

-- First, let's see what domains already have rules
SELECT 'Existing content type rules:' as info;
SELECT domain, content_type, trust_score_modifier FROM content_type_rules WHERE is_active = true ORDER BY domain;

-- Check if example-blog.com already has rules
SELECT 'Does example-blog.com have rules?' as info;
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'example-blog.com' AND is_active = true) 
        THEN 'YES - already has rules' 
        ELSE 'NO - ready for testing' 
    END as status;

-- Step 2: Insert test ratings for example-blog.com
-- We'll create 5 ratings to ensure it meets the minimum threshold (≥3)

INSERT INTO public.ratings (
    url_hash,
    url,
    domain,
    rating,
    is_spam,
    is_misleading,
    is_scam,
    processed,
    created_at
) VALUES 
-- Test rating 1: Good article
(
    encode(sha256('https://example-blog.com/article/great-content'::bytea), 'hex'),
    'https://example-blog.com/article/great-content',
    'example-blog.com',
    4,
    false,
    false,
    false,
    false,
    NOW() - INTERVAL '2 hours'
),
-- Test rating 2: Another good article
(
    encode(sha256('https://example-blog.com/article/helpful-guide'::bytea), 'hex'),
    'https://example-blog.com/article/helpful-guide',
    'example-blog.com',
    5,
    false,
    false,
    false,
    false,
    NOW() - INTERVAL '1 hour'
),
-- Test rating 3: Blog post
(
    encode(sha256('https://example-blog.com/blog/interesting-post'::bytea), 'hex'),
    'https://example-blog.com/blog/interesting-post',
    'example-blog.com',
    4,
    false,
    false,
    false,
    false,
    NOW() - INTERVAL '30 minutes'
),
-- Test rating 4: Average content
(
    encode(sha256('https://example-blog.com/article/okay-content'::bytea), 'hex'),
    'https://example-blog.com/article/okay-content',
    'example-blog.com',
    3,
    false,
    false,
    false,
    false,
    NOW() - INTERVAL '15 minutes'
),
-- Test rating 5: One with spam report to test community feedback adjustment
(
    encode(sha256('https://example-blog.com/article/questionable-content'::bytea), 'hex'),
    'https://example-blog.com/article/questionable-content',
    'example-blog.com',
    2,
    true,  -- This one is marked as spam
    false,
    false,
    false,
    NOW() - INTERVAL '5 minutes'
);

-- Step 3: Verify the test data was inserted
SELECT 'Test ratings inserted:' as info;
SELECT 
    url,
    rating,
    is_spam,
    is_misleading,
    is_scam,
    created_at
FROM public.ratings 
WHERE domain = 'example-blog.com'
ORDER BY created_at DESC;

-- Step 4: Check that this domain is eligible for content rule generation
SELECT 'Domain eligibility check:' as info;
SELECT 
    r.domain,
    COUNT(*) as rating_count,
    AVG(r.rating) as avg_rating,
    COUNT(*) FILTER (WHERE r.is_spam = true) as spam_count,
    COUNT(*) FILTER (WHERE r.is_misleading = true) as misleading_count,
    COUNT(*) FILTER (WHERE r.is_scam = true) as scam_count,
    -- Show sample URLs that will be analyzed
    string_agg(r.url, ', ' ORDER BY r.created_at DESC) as sample_urls
FROM public.ratings r
WHERE r.domain = 'example-blog.com'
GROUP BY r.domain;

-- Step 5: Run the content type rule generation
SELECT 'Running auto_generate_content_type_rules():' as info;
SELECT auto_generate_content_type_rules();

-- Step 6: Check if a rule was created for our test domain
SELECT 'New rule created for example-blog.com:' as info;
SELECT 
    domain,
    content_type,
    trust_score_modifier,
    min_ratings_required,
    description,
    created_at
FROM content_type_rules 
WHERE domain = 'example-blog.com'
AND is_active = true;

-- Step 7: Test the enhanced trust scoring with the new rule
SELECT 'Testing enhanced trust score calculation:' as info;
SELECT 
    domain_score,
    community_score,
    final_score,
    content_type
FROM calculate_enhanced_trust_score(
    encode(sha256('https://example-blog.com/article/great-content'::bytea), 'hex'),
    'https://example-blog.com/article/great-content'
);

-- Step 8: Show the expected results
SELECT 'Expected results:' as info;
SELECT 
    'example-blog.com should be detected as "article" content type' as expectation_1,
    'Trust modifier should be +2 (but reduced due to 1 spam report out of 5 ratings = 20%)' as expectation_2,
    'Since spam ratio is 20%, modifier should be reduced by -3, so final modifier around -1' as expectation_3,
    'Min ratings should be increased from 3 to 4 due to spam reports' as expectation_4;

-- Cleanup (optional - uncomment to remove test data)
-- DELETE FROM public.ratings WHERE domain = 'example-blog.com';
-- DELETE FROM public.content_type_rules WHERE domain = 'example-blog.com';