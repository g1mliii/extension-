-- Remove Problematic Views to Fix Security Issues
-- These analytics views are causing persistent SECURITY DEFINER warnings
-- We'll remove them and create simple functions instead if needed

-- Drop the problematic views completely
DROP VIEW IF EXISTS trust_algorithm_performance CASCADE;
DROP VIEW IF EXISTS enhanced_trust_analytics CASCADE;

-- Create simple functions instead of views to avoid security issues
-- These can be called when analytics are needed

-- Function to get trust algorithm performance data
CREATE OR REPLACE FUNCTION get_trust_algorithm_performance(days_back INTEGER DEFAULT 30)
RETURNS TABLE(
    date DATE,
    content_type TEXT,
    urls_processed BIGINT,
    avg_final_score DECIMAL,
    avg_domain_score DECIMAL,
    avg_community_score DECIMAL,
    excellent_count BIGINT,
    poor_count BIGINT,
    avg_ratings_per_url DECIMAL
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC('day', last_updated)::DATE as date,
        COALESCE(u.content_type, 'general'::text) as content_type,
        COUNT(*) as urls_processed,
        ROUND(AVG(COALESCE(u.final_trust_score, u.trust_score)), 2) as avg_final_score,
        ROUND(AVG(u.domain_trust_score), 2) as avg_domain_score,
        ROUND(AVG(u.community_trust_score), 2) as avg_community_score,
        COUNT(*) FILTER (WHERE COALESCE(u.final_trust_score, u.trust_score) >= 80) as excellent_count,
        COUNT(*) FILTER (WHERE COALESCE(u.final_trust_score, u.trust_score) < 20) as poor_count,
        ROUND(AVG(u.rating_count), 1) as avg_ratings_per_url
    FROM public.url_stats u
    WHERE COALESCE(u.final_trust_score, u.trust_score) IS NOT NULL 
      AND u.last_updated >= (NOW() - (days_back || ' days')::INTERVAL)
    GROUP BY DATE_TRUNC('day', u.last_updated), COALESCE(u.content_type, 'general'::text)
    ORDER BY date DESC, content_type;
END;
$$;

-- Function to get enhanced trust analytics data
CREATE OR REPLACE FUNCTION get_enhanced_trust_analytics()
RETURNS TABLE(
    content_type TEXT,
    score_category TEXT,
    url_count BIGINT,
    avg_final_score DECIMAL,
    avg_domain_score DECIMAL,
    avg_community_score DECIMAL,
    avg_ratings_per_url DECIMAL
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(u.content_type, 'general'::text) as content_type,
        CASE
            WHEN COALESCE(u.final_trust_score, u.trust_score) >= 80 THEN 'Excellent (80-100)'::text
            WHEN COALESCE(u.final_trust_score, u.trust_score) >= 60 THEN 'Good (60-79)'::text
            WHEN COALESCE(u.final_trust_score, u.trust_score) >= 40 THEN 'Fair (40-59)'::text
            WHEN COALESCE(u.final_trust_score, u.trust_score) >= 20 THEN 'Poor (20-39)'::text
            ELSE 'Very Poor (0-19)'::text
        END as score_category,
        COUNT(*) as url_count,
        ROUND(AVG(COALESCE(u.final_trust_score, u.trust_score)), 2) as avg_final_score,
        ROUND(AVG(u.domain_trust_score), 2) as avg_domain_score,
        ROUND(AVG(u.community_trust_score), 2) as avg_community_score,
        ROUND(AVG(u.rating_count), 1) as avg_ratings_per_url
    FROM public.url_stats u
    WHERE COALESCE(u.final_trust_score, u.trust_score) IS NOT NULL
    GROUP BY 
        COALESCE(u.content_type, 'general'::text),
        CASE
            WHEN COALESCE(u.final_trust_score, u.trust_score) >= 80 THEN 'Excellent (80-100)'::text
            WHEN COALESCE(u.final_trust_score, u.trust_score) >= 60 THEN 'Good (60-79)'::text
            WHEN COALESCE(u.final_trust_score, u.trust_score) >= 40 THEN 'Fair (40-59)'::text
            WHEN COALESCE(u.final_trust_score, u.trust_score) >= 20 THEN 'Poor (20-39)'::text
            ELSE 'Very Poor (0-19)'::text
        END
    ORDER BY content_type, avg_final_score DESC;
END;
$$;

-- Grant permissions to the functions
GRANT EXECUTE ON FUNCTION get_trust_algorithm_performance(INTEGER) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_enhanced_trust_analytics() TO anon, authenticated, service_role;

-- Comments
COMMENT ON FUNCTION get_trust_algorithm_performance IS 'Replaces trust_algorithm_performance view - no security issues';
COMMENT ON FUNCTION get_enhanced_trust_analytics IS 'Replaces enhanced_trust_analytics view - no security issues';

-- Note: To use these functions instead of views:
-- SELECT * FROM get_trust_algorithm_performance(30);  -- Last 30 days
-- SELECT * FROM get_enhanced_trust_analytics();