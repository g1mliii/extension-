-- Simple Security Invoker Fix Migration
-- Implements Supabase's recommended SECURITY INVOKER approach without complex testing blocks

-- ============================================================================
-- SUPABASE RECOMMENDED FIX: USE SECURITY INVOKER FOR VIEWS
-- ============================================================================

-- Fix trust_algorithm_performance view
DROP VIEW IF EXISTS public.trust_algorithm_performance CASCADE;
CREATE OR REPLACE VIEW public.trust_algorithm_performance
WITH (security_invoker=on)
AS
SELECT 
    DATE_TRUNC('day', last_updated)::DATE as date,
    COALESCE(content_type, 'general') as content_type,
    COUNT(*) as urls_processed,
    ROUND(AVG(COALESCE(final_trust_score, trust_score)), 2) as avg_final_score,
    ROUND(AVG(domain_trust_score), 2) as avg_domain_score,
    ROUND(AVG(community_trust_score), 2) as avg_community_score,
    COUNT(*) FILTER (WHERE COALESCE(final_trust_score, trust_score) >= 80) as excellent_count,
    COUNT(*) FILTER (WHERE COALESCE(final_trust_score, trust_score) < 20) as poor_count,
    ROUND(AVG(rating_count), 1) as avg_ratings_per_url
FROM url_stats
WHERE COALESCE(final_trust_score, trust_score) IS NOT NULL 
  AND last_updated >= (NOW() - INTERVAL '30 days')
GROUP BY DATE_TRUNC('day', last_updated), COALESCE(content_type, 'general')
ORDER BY date DESC, content_type;

-- Set permissions
ALTER VIEW public.trust_algorithm_performance OWNER TO postgres;
GRANT SELECT ON public.trust_algorithm_performance TO anon, authenticated, service_role;

-- Fix processing_status_summary view
DROP VIEW IF EXISTS public.processing_status_summary CASCADE;
CREATE OR REPLACE VIEW public.processing_status_summary
WITH (security_invoker=on)
AS
SELECT 
    processing_status,
    COUNT(*) as count_total,
    ROUND(COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 2) as percentage
FROM url_stats
WHERE processing_status IS NOT NULL
GROUP BY processing_status
ORDER BY count_total DESC;

-- Set permissions
ALTER VIEW public.processing_status_summary OWNER TO postgres;
GRANT SELECT ON public.processing_status_summary TO anon, authenticated, service_role;

-- Fix domain_cache_status view
DROP VIEW IF EXISTS public.domain_cache_status CASCADE;
CREATE OR REPLACE VIEW public.domain_cache_status
WITH (security_invoker=on)
AS
SELECT 
    domain,
    cache_expires_at,
    CASE 
        WHEN cache_expires_at > NOW() THEN 'valid'
        ELSE 'expired'
    END as cache_status,
    domain_age_days,
    ssl_valid,
    http_status,
    google_safe_browsing_status,
    hybrid_analysis_status,
    created_at
FROM domain_cache
ORDER BY cache_expires_at DESC;

-- Set permissions
ALTER VIEW public.domain_cache_status OWNER TO postgres;
GRANT SELECT ON public.domain_cache_status TO anon, authenticated, service_role;

-- Fix enhanced_trust_analytics view
DROP VIEW IF EXISTS public.enhanced_trust_analytics CASCADE;
CREATE OR REPLACE VIEW public.enhanced_trust_analytics
WITH (security_invoker=on)
AS
SELECT 
    COALESCE(content_type, 'general') as content_type,
    CASE
        WHEN COALESCE(final_trust_score, trust_score) >= 80 THEN 'Excellent (80-100)'
        WHEN COALESCE(final_trust_score, trust_score) >= 60 THEN 'Good (60-79)'
        WHEN COALESCE(final_trust_score, trust_score) >= 40 THEN 'Fair (40-59)'
        WHEN COALESCE(final_trust_score, trust_score) >= 20 THEN 'Poor (20-39)'
        ELSE 'Very Poor (0-19)'
    END as score_category,
    COUNT(*) as url_count,
    ROUND(AVG(COALESCE(final_trust_score, trust_score)), 2) as avg_final_score,
    ROUND(AVG(domain_trust_score), 2) as avg_domain_score,
    ROUND(AVG(community_trust_score), 2) as avg_community_score,
    ROUND(AVG(rating_count), 1) as avg_ratings_per_url
FROM url_stats
WHERE COALESCE(final_trust_score, trust_score) IS NOT NULL
GROUP BY 
    COALESCE(content_type, 'general'),
    CASE
        WHEN COALESCE(final_trust_score, trust_score) >= 80 THEN 'Excellent (80-100)'
        WHEN COALESCE(final_trust_score, trust_score) >= 60 THEN 'Good (60-79)'
        WHEN COALESCE(final_trust_score, trust_score) >= 40 THEN 'Fair (40-59)'
        WHEN COALESCE(final_trust_score, trust_score) >= 20 THEN 'Poor (20-39)'
        ELSE 'Very Poor (0-19)'
    END
ORDER BY content_type, avg_final_score DESC;

-- Set permissions
ALTER VIEW public.enhanced_trust_analytics OWNER TO postgres;
GRANT SELECT ON public.enhanced_trust_analytics TO anon, authenticated, service_role;

-- Simple completion message
SELECT 'Supabase SECURITY INVOKER views migration completed successfully' as migration_status;