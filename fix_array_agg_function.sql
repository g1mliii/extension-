-- Direct fix for the array_agg function syntax error
-- This will drop and recreate the function with correct syntax

-- First, drop the problematic function if it exists
DROP FUNCTION IF EXISTS auto_generate_content_type_rules();

-- Recreate the function with correct syntax
CREATE OR REPLACE FUNCTION auto_generate_content_type_rules()
RETURNS TABLE(
    domain TEXT,
    content_type TEXT,
    trust_modifier NUMERIC,
    confidence_score NUMERIC,
    sample_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH domain_stats AS (
        SELECT 
            r.domain,
            COUNT(*) as rating_count,
            AVG(r.score) as avg_rating,
            COUNT(*) FILTER (WHERE r.is_spam = true) as spam_count,
            COUNT(*) FILTER (WHERE r.is_misleading = true) as misleading_count,
            COUNT(*) FILTER (WHERE r.is_scam = true) as scam_count,
            -- Sample URLs to analyze patterns (get up to 5 most recent) - FIXED: removed DISTINCT
            (array_agg(r.url ORDER BY r.created_at DESC))[1:5] as sample_urls
        FROM public.ratings r
        WHERE r.domain IS NOT NULL
        GROUP BY r.domain
        HAVING COUNT(*) >= 3  -- Only analyze domains with sufficient data
    ),
    content_analysis AS (
        SELECT 
            ds.domain,
            ds.rating_count,
            ds.avg_rating,
            ds.spam_count,
            ds.misleading_count,
            ds.scam_count,
            ds.sample_urls,
            -- Detect content type based on domain patterns
            CASE 
                WHEN ds.domain LIKE '%youtube.com%' OR ds.domain LIKE '%vimeo.com%' OR ds.domain LIKE '%twitch.tv%' THEN 'video'
                WHEN ds.domain LIKE '%twitter.com%' OR ds.domain LIKE '%x.com%' OR ds.domain LIKE '%facebook.com%' OR ds.domain LIKE '%instagram.com%' OR ds.domain LIKE '%tiktok.com%' THEN 'social'
                WHEN ds.domain LIKE '%github.com%' OR ds.domain LIKE '%gitlab.com%' OR ds.domain LIKE '%bitbucket.org%' THEN 'code'
                WHEN ds.domain LIKE '%stackoverflow.com%' OR ds.domain LIKE '%stackexchange.com%' THEN 'qa'
                WHEN ds.domain LIKE '%.edu%' OR ds.domain LIKE '%coursera.org%' OR ds.domain LIKE '%edx.org%' THEN 'education'
                WHEN ds.domain LIKE '%news%' OR ds.domain LIKE '%bbc.com%' OR ds.domain LIKE '%cnn.com%' OR ds.domain LIKE '%reuters.com%' THEN 'news'
                WHEN ds.domain LIKE '%wiki%' THEN 'reference'
                ELSE 'general'
            END as detected_content_type,
            -- Calculate trust modifier based on community feedback
            CASE 
                WHEN (ds.spam_count::FLOAT / ds.rating_count) > 0.3 THEN -15.0  -- High spam rate
                WHEN (ds.misleading_count::FLOAT / ds.rating_count) > 0.3 THEN -10.0  -- High misleading rate
                WHEN (ds.scam_count::FLOAT / ds.rating_count) > 0.2 THEN -20.0  -- High scam rate
                WHEN ds.avg_rating >= 4.0 THEN 5.0   -- High community rating
                WHEN ds.avg_rating >= 3.5 THEN 2.0   -- Good community rating
                WHEN ds.avg_rating <= 2.0 THEN -5.0  -- Poor community rating
                ELSE 0.0  -- Neutral
            END as base_trust_modifier,
            -- Calculate confidence based on sample size and consistency
            LEAST(100.0, (ds.rating_count::FLOAT / 10.0) * 100.0) as confidence_score
        FROM domain_stats ds
    )
    SELECT 
        ca.domain::TEXT,
        ca.detected_content_type::TEXT,
        ca.base_trust_modifier::NUMERIC,
        ca.confidence_score::NUMERIC,
        ca.rating_count::INTEGER
    FROM content_analysis ca
    WHERE ca.confidence_score >= 30.0  -- Only return rules with reasonable confidence
    ORDER BY ca.confidence_score DESC, ca.rating_count DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION auto_generate_content_type_rules() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_generate_content_type_rules() TO service_role;