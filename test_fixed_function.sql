-- Test the corrected content rule generation function
SELECT 'Testing corrected content rule generation function:' as info;
SELECT auto_generate_content_type_rules();

-- Check what rules were created
SELECT 'Content type rules created:' as info;
SELECT domain, content_type, trust_score_modifier, min_ratings_required, description
FROM content_type_rules 
WHERE is_active = true
ORDER BY created_at DESC
LIMIT 10;