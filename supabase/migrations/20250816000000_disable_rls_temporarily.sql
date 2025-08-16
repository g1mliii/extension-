-- Temporarily disable RLS on all tables for debugging
-- This will help identify if RLS policies are causing the API issues

-- Disable RLS on all main tables
ALTER TABLE public.ratings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.url_stats DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_blacklist DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_type_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.trust_algorithm_config DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies to clean up
DROP POLICY IF EXISTS "authenticated_users_can_insert_own_ratings" ON public.ratings;
DROP POLICY IF EXISTS "authenticated_users_can_read_own_ratings" ON public.ratings;
DROP POLICY IF EXISTS "authenticated_users_can_update_own_ratings" ON public.ratings;
DROP POLICY IF EXISTS "service_role_can_read_all_ratings" ON public.ratings;
DROP POLICY IF EXISTS "service_role_can_update_processed" ON public.ratings;

DROP POLICY IF EXISTS "Anyone can read url stats" ON public.url_stats;
DROP POLICY IF EXISTS "Allow service role full access to url_stats" ON public.url_stats;

DROP POLICY IF EXISTS "Optimized domain cache access" ON public.domain_cache;

DROP POLICY IF EXISTS "Optimized blacklist access" ON public.domain_blacklist;
DROP POLICY IF EXISTS "Service role blacklist management" ON public.domain_blacklist;

DROP POLICY IF EXISTS "Optimized content rules access" ON public.content_type_rules;
DROP POLICY IF EXISTS "Service role content rules management" ON public.content_type_rules;

DROP POLICY IF EXISTS "Optimized config access" ON public.trust_algorithm_config;
DROP POLICY IF EXISTS "Service role config management" ON public.trust_algorithm_config;

-- Add simple grants for public access (temporary for debugging)
GRANT SELECT ON public.url_stats TO anon;
GRANT SELECT ON public.domain_cache TO anon;
GRANT SELECT ON public.domain_blacklist TO anon;
GRANT SELECT ON public.content_type_rules TO anon;
GRANT SELECT ON public.trust_algorithm_config TO anon;

-- Allow authenticated users to insert/update ratings
GRANT SELECT, INSERT, UPDATE ON public.ratings TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.url_stats TO authenticated;

-- Service role gets full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;