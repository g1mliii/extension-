-- Fix API Database Compatibility
-- This migration ensures all database functions and tables used by the current API implementation are properly migrated

-- First, ensure all required tables exist with correct schemas

-- Ensure ratings table has all required columns
ALTER TABLE public.ratings ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure url_stats table has all required columns
ALTER TABLE public.url_stats ADD COLUMN IF NOT EXISTS last_accessed TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Ensure domain_cache table exists (should be created by previous migrations)
-- Add any missing columns that might be referenced by the API
ALTER TABLE public.domain_cache ADD COLUMN IF NOT EXISTS phishtank_status TEXT;

-- Create missing indexes for performance
CREATE INDEX IF NOT EXISTS idx_ratings_created_at ON public.ratings(created_at);
CREATE INDEX IF NOT EXISTS idx_url_stats_last_accessed ON public.url_stats(last_accessed);
CREATE INDEX IF NOT EXISTS idx_domain_cache_last_checked ON public.domain_cache(last_checked);

-- Fix the enhanced_trust_analytics issue by creating a view that matches the API expectations
-- The API expects to query this as a table, but it was replaced with a function
CREATE OR REPLACE VIEW enhanced_trust_analytics AS
SELECT 
    content_type,
    CASE 
        WHEN final_trust_score >= 80 THEN 'Excellent (80-100)'
        WHEN final_trust_score >= 60 THEN 'Good (60-79)'
        WHEN final_trust_score >= 40 THEN 'Fair (40-59)'
        WHEN final_trust_score >= 20 THEN 'Poor (20-39)'
        ELSE 'Very Poor (0-19)'
    END as score_category,
    COUNT(*) as url_count,
    ROUND(AVG(final_trust_score), 2) as avg_final_score,
    ROUND(AVG(domain_trust_score), 2) as avg_domain_score,
    ROUND(AVG(community_trust_score), 2) as avg_community_score,
    ROUND(AVG(rating_count), 1) as avg_ratings_per_url
FROM public.url_stats 
WHERE final_trust_score IS NOT NULL
GROUP BY content_type, 
    CASE 
        WHEN final_trust_score >= 80 THEN 'Excellent (80-100)'
        WHEN final_trust_score >= 60 THEN 'Good (60-79)'
        WHEN final_trust_score >= 40 THEN 'Fair (40-59)'
        WHEN final_trust_score >= 20 THEN 'Poor (20-39)'
        ELSE 'Very Poor (0-19)'
    END
ORDER BY content_type, avg_final_score DESC;

-- Ensure trust_algorithm_performance view exists (should be created by previous migrations)
-- Recreate it if it was dropped
CREATE OR REPLACE VIEW trust_algorithm_performance AS
SELECT 
    DATE_TRUNC('day', last_updated) as date,
    content_type,
    COUNT(*) as urls_processed,
    AVG(final_trust_score) as avg_final_score,
    AVG(domain_trust_score) as avg_domain_score,
    AVG(community_trust_score) as avg_community_score,
    COUNT(*) FILTER (WHERE final_trust_score >= 80) as excellent_count,
    COUNT(*) FILTER (WHERE final_trust_score < 20) as poor_count,
    AVG(rating_count) as avg_ratings_per_url
FROM public.url_stats 
WHERE final_trust_score IS NOT NULL
  AND last_updated >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', last_updated), content_type
ORDER BY date DESC, content_type;

-- Ensure all required database functions exist
-- These functions should exist from previous migrations, but let's verify the key ones

-- Verify batch_aggregate_ratings function exists (this is called by cron job)
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'batch_aggregate_ratings'
    ) THEN
        RAISE EXCEPTION 'batch_aggregate_ratings function is missing - this should be created by previous migrations';
    END IF;
END;
$;

-- Verify calculate_enhanced_trust_score function exists
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'calculate_enhanced_trust_score'
    ) THEN
        RAISE EXCEPTION 'calculate_enhanced_trust_score function is missing - this should be created by previous migrations';
    END IF;
END;
$;

-- Verify get_cache_statistics function exists (used by trust-admin API)
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'get_cache_statistics'
    ) THEN
        RAISE EXCEPTION 'get_cache_statistics function is missing - this should be created by previous migrations';
    END IF;
END;
$;

-- Verify update_trust_config function exists (used by trust-admin API)
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'update_trust_config'
    ) THEN
        RAISE EXCEPTION 'update_trust_config function is missing - this should be created by previous migrations';
    END IF;
END;
$;

-- Verify recalculate_with_new_config function exists (used by trust-admin API)
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_proc p 
        JOIN pg_namespace n ON p.pronamespace = n.oid 
        WHERE n.nspname = 'public' AND p.proname = 'recalculate_with_new_config'
    ) THEN
        RAISE EXCEPTION 'recalculate_with_new_config function is missing - this should be created by previous migrations';
    END IF;
END;
$;

-- Ensure the cron job exists for rating aggregation
-- This should be created by previous migrations, but let's verify
DO $
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM cron.job WHERE jobname = 'aggregate-ratings-job'
    ) THEN
        -- Create the cron job if it doesn't exist
        PERFORM cron.schedule(
            'aggregate-ratings-job',
            '*/5 * * * *',
            'SELECT batch_aggregate_ratings();'
        );
        RAISE NOTICE 'Created missing cron job: aggregate-ratings-job';
    END IF;
END;
$;

-- Grant necessary permissions for the API functions to work with RLS disabled
-- These grants should already exist from the RLS disable migration, but let's ensure they're complete

-- Ensure anon can read public data
GRANT SELECT ON public.url_stats TO anon;
GRANT SELECT ON public.domain_cache TO anon;
GRANT SELECT ON public.domain_blacklist TO anon;
GRANT SELECT ON public.content_type_rules TO anon;
GRANT SELECT ON public.trust_algorithm_config TO anon;

-- Ensure authenticated users can manage ratings and access stats
GRANT SELECT, INSERT, UPDATE ON public.ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.url_stats TO authenticated;
GRANT SELECT ON public.domain_cache TO authenticated;

-- Ensure service role has full access (needed for the current API implementation)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant access to views
GRANT SELECT ON enhanced_trust_analytics TO anon, authenticated, service_role;
GRANT SELECT ON trust_algorithm_performance TO anon, authenticated, service_role;

-- Add comments for documentation
COMMENT ON VIEW enhanced_trust_analytics IS 'Trust score analytics view - recreated for API compatibility';
COMMENT ON VIEW trust_algorithm_performance IS 'Algorithm performance monitoring view - recreated for API compatibility';

-- Verify all required tables exist
DO $
DECLARE
    missing_tables TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Check for required tables
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ratings') THEN
        missing_tables := array_append(missing_tables, 'ratings');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'url_stats') THEN
        missing_tables := array_append(missing_tables, 'url_stats');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'domain_cache') THEN
        missing_tables := array_append(missing_tables, 'domain_cache');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'domain_blacklist') THEN
        missing_tables := array_append(missing_tables, 'domain_blacklist');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'content_type_rules') THEN
        missing_tables := array_append(missing_tables, 'content_type_rules');
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trust_algorithm_config') THEN
        missing_tables := array_append(missing_tables, 'trust_algorithm_config');
    END IF;
    
    IF array_length(missing_tables, 1) > 0 THEN
        RAISE EXCEPTION 'Missing required tables: %', array_to_string(missing_tables, ', ');
    END IF;
    
    RAISE NOTICE 'All required tables exist';
END;
$;

-- Final verification: Test that key API operations would work
DO $
DECLARE
    test_url_hash TEXT := 'test_hash_' || extract(epoch from now())::text;
    test_domain TEXT := 'example.com';
BEGIN
    -- Test that we can insert into url_stats (used by API)
    INSERT INTO public.url_stats (url_hash, domain, last_updated, last_accessed)
    VALUES (test_url_hash, test_domain, NOW(), NOW());
    
    -- Test that we can query url_stats (used by API)
    PERFORM * FROM public.url_stats WHERE url_hash = test_url_hash;
    
    -- Test that we can query domain_cache (used by API)
    PERFORM * FROM public.domain_cache WHERE domain = test_domain;
    
    -- Clean up test data
    DELETE FROM public.url_stats WHERE url_hash = test_url_hash;
    
    RAISE NOTICE 'API database operations test passed';
END;
$;

-- Log completion
DO $
BEGIN
    RAISE NOTICE 'API database compatibility migration completed successfully';
    RAISE NOTICE 'All required tables, functions, views, and permissions are in place';
    RAISE NOTICE 'The API should now work correctly with the current database schema';
END;
$;