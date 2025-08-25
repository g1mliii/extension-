-- Task 19: Implement automated content type rule generation and cron job monitoring
-- This migration creates automated content type rule generation and comprehensive cron job monitoring

-- First, remove any duplicate enhanced-processing-job if it exists
DO $$
DECLARE
    job_exists BOOLEAN;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TASK 19: AUTOMATED CONTENT RULES & MONITORING ===';
    RAISE NOTICE '';
    
    -- Check and remove duplicate enhanced-processing-job
    SELECT EXISTS (
        SELECT 1 FROM cron.job 
        WHERE jobname = 'enhanced-processing-job'
    ) INTO job_exists;
    
    IF job_exists THEN
        PERFORM cron.unschedule('enhanced-processing-job');
        RAISE NOTICE '✓ Removed duplicate enhanced-processing-job cron job';
        RAISE NOTICE '  - Eliminates redundant processing that was duplicating aggregate-ratings-job';
    ELSE
        RAISE NOTICE '✓ No duplicate enhanced-processing-job found (already clean)';
    END IF;
END;
$$;

-- Create automated content type rule generation function
CREATE OR REPLACE FUNCTION public.auto_generate_content_type_rules()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rule_count INTEGER := 0;
    new_rules_count INTEGER := 0;
    domain_record RECORD;
    content_type_detected TEXT;
    trust_modifier DECIMAL;
    min_ratings INTEGER;
    rule_description TEXT;
BEGIN
    RAISE NOTICE 'Starting automated content type rule generation at %', NOW();
    
    -- Analyze domains with ratings but no content type rules
    FOR domain_record IN 
        SELECT 
            r.domain,
            COUNT(*) as rating_count,
            AVG(r.rating) as avg_rating,
            COUNT(*) FILTER (WHERE r.is_spam = true) as spam_count,
            COUNT(*) FILTER (WHERE r.is_misleading = true) as misleading_count,
            COUNT(*) FILTER (WHERE r.is_scam = true) as scam_count,
            -- Sample URLs to analyze patterns (get up to 5 most recent)
            (array_agg(r.url ORDER BY r.created_at DESC))[1:5] as sample_urls
        FROM public.ratings r
        WHERE r.domain IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.content_type_rules ctr 
            WHERE ctr.domain = r.domain AND ctr.is_active = true
        )
        GROUP BY r.domain
        HAVING COUNT(*) >= 3 -- Only domains with at least 3 ratings
        ORDER BY COUNT(*) DESC
        LIMIT 50 -- Process top 50 domains per run
    LOOP
        -- Detect content type based on domain patterns and URL analysis
        content_type_detected := 'general'; -- Default
        trust_modifier := 0;
        min_ratings := 3;
        rule_description := 'Auto-generated rule based on domain analysis';
        
        -- Video platforms
        IF domain_record.domain IN ('youtube.com', 'youtu.be', 'vimeo.com', 'dailymotion.com', 'twitch.tv') THEN
            content_type_detected := 'video';
            trust_modifier := 5;
            min_ratings := 2;
            rule_description := 'Video platform - established content hosting';
            
        -- Social media platforms
        ELSIF domain_record.domain IN ('facebook.com', 'twitter.com', 'x.com', 'instagram.com', 'tiktok.com', 'snapchat.com', 'pinterest.com') THEN
            content_type_detected := 'social';
            trust_modifier := -2;
            min_ratings := 5;
            rule_description := 'Social media - requires more community validation';
            
        -- Code repositories and developer platforms
        ELSIF domain_record.domain IN ('github.com', 'gitlab.com', 'bitbucket.org', 'sourceforge.net', 'codepen.io') THEN
            content_type_detected := 'code';
            trust_modifier := 5;
            min_ratings := 2;
            rule_description := 'Code repository - open source development platform';
            
        -- News and media sites (detect by domain patterns)
        ELSIF domain_record.domain ~ '\.(com|org|net)$' AND (
            domain_record.domain LIKE '%news%' OR 
            domain_record.domain LIKE '%times%' OR 
            domain_record.domain LIKE '%post%' OR
            domain_record.domain IN ('cnn.com', 'bbc.com', 'reuters.com', 'ap.org', 'npr.org', 'pbs.org')
        ) THEN
            content_type_detected := 'news';
            -- Only give high trust to established news sources, not just any domain with 'news'
            trust_modifier := CASE 
                WHEN domain_record.domain IN ('cnn.com', 'bbc.com', 'reuters.com', 'ap.org', 'npr.org', 'pbs.org') THEN 8
                ELSE 2 -- Lower modifier for unknown news-like domains
            END;
            min_ratings := CASE 
                WHEN domain_record.domain IN ('cnn.com', 'bbc.com', 'reuters.com', 'ap.org', 'npr.org', 'pbs.org') THEN 2
                ELSE 4 -- Require more validation for unknown news-like domains
            END;
            rule_description := CASE 
                WHEN domain_record.domain IN ('cnn.com', 'bbc.com', 'reuters.com', 'ap.org', 'npr.org', 'pbs.org') THEN 'Established news media - verified journalism source'
                ELSE 'News-like domain - requires community validation'
            END;
            
        -- Educational institutions (.edu domains and known platforms)
        ELSIF domain_record.domain ~ '\.edu$' OR domain_record.domain IN ('coursera.org', 'edx.org', 'khanacademy.org', 'udemy.com') THEN
            content_type_detected := 'education';
            trust_modifier := 7;
            min_ratings := 2;
            rule_description := 'Educational content - academic or learning platform';
            
        -- E-commerce platforms
        ELSIF domain_record.domain IN ('amazon.com', 'ebay.com', 'etsy.com', 'shopify.com', 'walmart.com', 'target.com') THEN
            content_type_detected := 'ecommerce';
            trust_modifier := 2;
            min_ratings := 3;
            rule_description := 'E-commerce platform - product listings';
            
        -- Documentation and reference sites
        ELSIF domain_record.domain IN ('stackoverflow.com', 'stackexchange.com', 'developer.mozilla.org', 'w3schools.com', 'docs.microsoft.com') THEN
            content_type_detected := 'documentation';
            trust_modifier := 8;
            min_ratings := 1;
            rule_description := 'Technical documentation - reference material';
            
        -- Professional networking
        ELSIF domain_record.domain IN ('linkedin.com', 'glassdoor.com', 'indeed.com') THEN
            content_type_detected := 'professional';
            trust_modifier := 3;
            min_ratings := 2;
            rule_description := 'Professional networking - career-focused content';
            
        -- Entertainment platforms
        ELSIF domain_record.domain IN ('netflix.com', 'hulu.com', 'disney.com', 'spotify.com', 'apple.com') THEN
            content_type_detected := 'entertainment';
            trust_modifier := 3;
            min_ratings := 3;
            rule_description := 'Entertainment platform - media content';
            
        -- Analyze URL patterns for more specific detection
        ELSE
            -- Check URL patterns in sample URLs for more specific content type detection
            DECLARE
                url_sample TEXT;
            BEGIN
                FOREACH url_sample IN ARRAY domain_record.sample_urls
                LOOP
                    -- Video content patterns
                    IF url_sample ~ '/watch\?v=|/video/|/v/|/embed/' THEN
                        content_type_detected := 'video';
                        trust_modifier := 2;
                        min_ratings := 3;
                        rule_description := 'Video content detected from URL patterns';
                        EXIT;
                    -- Article/blog patterns
                    ELSIF url_sample ~ '/article/|/blog/|/post/|/news/' THEN
                        content_type_detected := 'article';
                        trust_modifier := 2; -- Reasonable boost for article content
                        min_ratings := 3; -- Standard validation requirement
                        rule_description := 'Article content detected from URL patterns';
                        EXIT;
                    -- Product pages
                    ELSIF url_sample ~ '/product/|/item/|/dp/|/p/' THEN
                        content_type_detected := 'ecommerce';
                        trust_modifier := 1;
                        min_ratings := 4;
                        rule_description := 'Product page detected from URL patterns';
                        EXIT;
                    END IF;
                END LOOP;
            END;
        END IF;
        
        -- Adjust trust modifier based on community feedback
        IF domain_record.spam_count > domain_record.rating_count * 0.3 THEN
            trust_modifier := trust_modifier - 5; -- High spam reports
            min_ratings := min_ratings + 2;
        ELSIF domain_record.misleading_count > domain_record.rating_count * 0.2 THEN
            trust_modifier := trust_modifier - 3; -- High misleading reports
            min_ratings := min_ratings + 1;
        ELSIF domain_record.scam_count > domain_record.rating_count * 0.1 THEN
            trust_modifier := trust_modifier - 8; -- Any significant scam reports
            min_ratings := min_ratings + 3;
        END IF;
        
        -- Ensure reasonable bounds
        trust_modifier := GREATEST(-10, LEAST(10, trust_modifier));
        min_ratings := GREATEST(1, LEAST(10, min_ratings));
        
        -- Create the content type rule
        INSERT INTO public.content_type_rules (
            domain,
            content_type,
            url_pattern,
            trust_score_modifier,
            min_ratings_required,
            description,
            is_active
        ) VALUES (
            domain_record.domain,
            content_type_detected,
            NULL, -- General rule for entire domain
            trust_modifier,
            min_ratings,
            rule_description || ' (based on ' || domain_record.rating_count || ' ratings)',
            true
        );
        
        new_rules_count := new_rules_count + 1;
        
        RAISE NOTICE 'Created rule for %: % (modifier: %, min_ratings: %)', 
            domain_record.domain, content_type_detected, trust_modifier, min_ratings;
            
    END LOOP;
    
    -- Add predefined rules for major platforms that might not have ratings yet
    INSERT INTO public.content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'facebook.com', 'social', '/.*/(posts|photos)/', -1, 5, 'Facebook posts - require more validation', true
    WHERE NOT EXISTS (SELECT 1 FROM public.content_type_rules WHERE domain = 'facebook.com' AND content_type = 'social');
    
    INSERT INTO public.content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'instagram.com', 'social', '/p/', -1, 4, 'Instagram posts', true
    WHERE NOT EXISTS (SELECT 1 FROM public.content_type_rules WHERE domain = 'instagram.com' AND content_type = 'social');
    
    INSERT INTO public.content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'tiktok.com', 'social', '/@.*/', -2, 6, 'TikTok videos - high variability', true
    WHERE NOT EXISTS (SELECT 1 FROM public.content_type_rules WHERE domain = 'tiktok.com' AND content_type = 'social');
    
    INSERT INTO public.content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'cnn.com', 'news', '/.*/', 8, 2, 'CNN news articles - established source', true
    WHERE NOT EXISTS (SELECT 1 FROM public.content_type_rules WHERE domain = 'cnn.com' AND content_type = 'news');
    
    INSERT INTO public.content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'bbc.com', 'news', '/news/', 9, 2, 'BBC news - high trust', true
    WHERE NOT EXISTS (SELECT 1 FROM public.content_type_rules WHERE domain = 'bbc.com' AND content_type = 'news');
    
    INSERT INTO public.content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'reuters.com', 'news', '/.*/', 9, 2, 'Reuters - high credibility', true
    WHERE NOT EXISTS (SELECT 1 FROM public.content_type_rules WHERE domain = 'reuters.com' AND content_type = 'news');
    
    -- Count total active rules
    SELECT COUNT(*) INTO rule_count FROM public.content_type_rules WHERE is_active = true;
    
    RAISE NOTICE 'Content type rule generation completed: % new rules created, % total active rules', 
        new_rules_count, rule_count;
    
    RETURN 'Content type rules updated. New rules: ' || new_rules_count || ', Total active rules: ' || rule_count;
END;
$$;

-- Create cron job status monitoring function
CREATE OR REPLACE FUNCTION public.get_cron_job_status()
RETURNS TABLE(
    job_name TEXT,
    schedule TEXT,
    command TEXT,
    active BOOLEAN,
    last_run TIMESTAMP WITH TIME ZONE,
    next_run TIMESTAMP WITH TIME ZONE,
    run_count BIGINT,
    success_count BIGINT,
    failure_count BIGINT,
    avg_runtime_seconds NUMERIC,
    status_summary TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    processing_stats RECORD;
BEGIN
    RAISE NOTICE 'Generating cron job status report at %', NOW();
    
    -- Return comprehensive cron job status information
    RETURN QUERY
    SELECT 
        j.jobname::TEXT as job_name,
        j.schedule::TEXT,
        j.command::TEXT,
        j.active,
        -- Calculate last run from job history if available
        (SELECT MAX(start_time) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid) as last_run,
        -- Calculate next run based on schedule (simplified - actual calculation is complex)
        CASE 
            WHEN j.schedule = '*/5 * * * *' THEN 
                date_trunc('minute', NOW()) + INTERVAL '5 minutes' - 
                (EXTRACT(minute FROM NOW())::INTEGER % 5) * INTERVAL '1 minute'
            WHEN j.schedule = '0 3 * * *' THEN 
                date_trunc('day', NOW()) + INTERVAL '1 day' + INTERVAL '3 hours'
            WHEN j.schedule = '0 2 * * *' THEN 
                date_trunc('day', NOW()) + INTERVAL '1 day' + INTERVAL '2 hours'
            ELSE NOW() + INTERVAL '1 hour' -- Default fallback
        END as next_run,
        -- Job execution statistics
        COALESCE((SELECT COUNT(*) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid), 0) as run_count,
        COALESCE((SELECT COUNT(*) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid AND jrd.return_message NOT LIKE 'ERROR%'), 0) as success_count,
        COALESCE((SELECT COUNT(*) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid AND jrd.return_message LIKE 'ERROR%'), 0) as failure_count,
        -- Average runtime calculation
        COALESCE((
            SELECT AVG(EXTRACT(EPOCH FROM (end_time - start_time)))
            FROM cron.job_run_details jrd 
            WHERE jrd.jobid = j.jobid AND end_time IS NOT NULL
        ), 0) as avg_runtime_seconds,
        -- Status summary
        CASE 
            WHEN NOT j.active THEN 'INACTIVE'
            WHEN (SELECT COUNT(*) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid) = 0 THEN 'NEVER_RUN'
            WHEN (SELECT COUNT(*) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid AND jrd.return_message LIKE 'ERROR%' AND jrd.start_time > NOW() - INTERVAL '1 hour') > 0 THEN 'RECENT_FAILURE'
            WHEN (SELECT MAX(start_time) FROM cron.job_run_details jrd WHERE jrd.jobid = j.jobid) < NOW() - INTERVAL '1 hour' AND j.schedule LIKE '%*%' THEN 'OVERDUE'
            ELSE 'HEALTHY'
        END as status_summary
    FROM cron.job j
    ORDER BY j.jobname;
    
    -- Log current processing status
    SELECT 
        COUNT(*) FILTER (WHERE processed = false) as pending_ratings,
        COUNT(*) FILTER (WHERE processed = true) as processed_ratings,
        COUNT(DISTINCT domain) as unique_domains,
        COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour') as recent_ratings
    INTO processing_stats
    FROM public.ratings;
    
    RAISE NOTICE 'Processing Status: % pending, % processed, % domains, % recent', 
        processing_stats.pending_ratings, processing_stats.processed_ratings, 
        processing_stats.unique_domains, processing_stats.recent_ratings;
        
END;
$$;

-- Create a function to get detailed URL processing status
CREATE OR REPLACE FUNCTION public.get_url_processing_status()
RETURNS TABLE(
    processing_status TEXT,
    url_count BIGINT,
    avg_trust_score NUMERIC,
    avg_rating_count NUMERIC,
    last_updated_range TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(us.processing_status, 'unprocessed') as processing_status,
        COUNT(*) as url_count,
        ROUND(AVG(us.final_trust_score), 2) as avg_trust_score,
        ROUND(AVG(us.rating_count), 2) as avg_rating_count,
        CASE 
            WHEN COUNT(*) = 0 THEN 'No data'
            ELSE 
                'Last: ' || 
                COALESCE(MAX(us.last_updated)::TEXT, 'Never') || 
                ', First: ' || 
                COALESCE(MIN(us.last_updated)::TEXT, 'Never')
        END as last_updated_range
    FROM public.url_stats us
    GROUP BY COALESCE(us.processing_status, 'unprocessed')
    ORDER BY url_count DESC;
END;
$$;

-- Create a function to monitor scheduler health
CREATE OR REPLACE FUNCTION public.get_scheduler_health()
RETURNS TABLE(
    metric_name TEXT,
    metric_value TEXT,
    status TEXT,
    recommendation TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    pending_count INTEGER;
    failed_jobs INTEGER;
    last_success TIMESTAMP WITH TIME ZONE;
    domain_cache_expired INTEGER;
BEGIN
    -- Check pending ratings
    SELECT COUNT(*) INTO pending_count FROM public.ratings WHERE processed = false;
    
    -- Check failed jobs in last 24 hours
    SELECT COUNT(*) INTO failed_jobs 
    FROM cron.job_run_details 
    WHERE return_message LIKE 'ERROR%' AND start_time > NOW() - INTERVAL '24 hours';
    
    -- Check last successful aggregation
    SELECT MAX(start_time) INTO last_success
    FROM cron.job_run_details jrd
    JOIN cron.job j ON j.jobid = jrd.jobid
    WHERE j.jobname = 'aggregate-ratings-job' AND jrd.return_message NOT LIKE 'ERROR%';
    
    -- Check expired domain cache entries
    SELECT COUNT(*) INTO domain_cache_expired 
    FROM public.domain_cache 
    WHERE cache_expires_at < NOW();
    
    -- Return health metrics
    RETURN QUERY VALUES
        ('Pending Ratings', pending_count::TEXT, 
         CASE WHEN pending_count > 100 THEN 'WARNING' WHEN pending_count > 500 THEN 'CRITICAL' ELSE 'OK' END,
         CASE WHEN pending_count > 100 THEN 'High backlog - check cron job' ELSE 'Normal processing' END),
        
        ('Failed Jobs (24h)', failed_jobs::TEXT,
         CASE WHEN failed_jobs > 5 THEN 'CRITICAL' WHEN failed_jobs > 0 THEN 'WARNING' ELSE 'OK' END,
         CASE WHEN failed_jobs > 0 THEN 'Check job logs for errors' ELSE 'No recent failures' END),
        
        ('Last Successful Run', COALESCE(last_success::TEXT, 'Never'),
         CASE WHEN last_success IS NULL THEN 'CRITICAL' 
              WHEN last_success < NOW() - INTERVAL '10 minutes' THEN 'WARNING' 
              ELSE 'OK' END,
         CASE WHEN last_success IS NULL THEN 'Cron job never succeeded' 
              WHEN last_success < NOW() - INTERVAL '10 minutes' THEN 'Cron job may be stuck' 
              ELSE 'Recent successful execution' END),
        
        ('Expired Domain Cache', domain_cache_expired::TEXT,
         CASE WHEN domain_cache_expired > 1000 THEN 'WARNING' ELSE 'OK' END,
         CASE WHEN domain_cache_expired > 1000 THEN 'Consider running domain analysis' ELSE 'Cache is fresh' END);
END;
$$;

-- Schedule the content type rule generation as a daily job
-- Option B: Create separate daily cron job for content rule generation
SELECT cron.schedule(
    'auto-generate-content-rules',
    '0 4 * * *', -- Daily at 4 AM
    'SELECT auto_generate_content_type_rules();'
);

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.auto_generate_content_type_rules() TO postgres;
GRANT EXECUTE ON FUNCTION public.get_cron_job_status() TO postgres;
GRANT EXECUTE ON FUNCTION public.get_url_processing_status() TO postgres;
GRANT EXECUTE ON FUNCTION public.get_scheduler_health() TO postgres;

-- Add function comments for documentation
COMMENT ON FUNCTION public.auto_generate_content_type_rules() IS 'Automatically generates content type rules based on domain patterns and rating statistics. Analyzes domains with ratings but no rules and creates appropriate content type classifications.';
COMMENT ON FUNCTION public.get_cron_job_status() IS 'Returns comprehensive status information for all cron jobs including execution history, success rates, and next run times.';
COMMENT ON FUNCTION public.get_url_processing_status() IS 'Returns detailed statistics about URL processing status categories and their distribution.';
COMMENT ON FUNCTION public.get_scheduler_health() IS 'Returns health metrics for the background processing system including pending work and failure rates.';

-- Verify the new cron job was created
DO $$
DECLARE
    job_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO job_count
    FROM cron.job 
    WHERE jobname = 'auto-generate-content-rules';
    
    IF job_count > 0 THEN
        RAISE NOTICE '✓ SUCCESS: auto-generate-content-rules cron job created';
        RAISE NOTICE '  Schedule: Daily at 4 AM (0 4 * * *)';
        RAISE NOTICE '  Command: SELECT auto_generate_content_type_rules();';
    ELSE
        RAISE EXCEPTION 'FAILED: auto-generate-content-rules cron job was not created';
    END IF;
END;
$$;

-- Log migration completion
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== TASK 19 IMPLEMENTATION COMPLETE ===';
    RAISE NOTICE '';
    RAISE NOTICE '✓ Created auto_generate_content_type_rules() function';
    RAISE NOTICE '  - Analyzes domains with ratings but no content type rules';
    RAISE NOTICE '  - Detects content types: video, social, code, news, education, etc.';
    RAISE NOTICE '  - Adjusts trust modifiers based on community feedback';
    RAISE NOTICE '  - Processes top 50 domains per run';
    RAISE NOTICE '';
    RAISE NOTICE '✓ Created comprehensive cron job monitoring functions:';
    RAISE NOTICE '  - get_cron_job_status(): Job execution history and schedules';
    RAISE NOTICE '  - get_url_processing_status(): URL processing statistics';
    RAISE NOTICE '  - get_scheduler_health(): System health metrics';
    RAISE NOTICE '';
    RAISE NOTICE '✓ Scheduled daily content rule generation:';
    RAISE NOTICE '  - Job: auto-generate-content-rules';
    RAISE NOTICE '  - Schedule: Daily at 4 AM';
    RAISE NOTICE '  - Continuously improves content type coverage';
    RAISE NOTICE '';
    RAISE NOTICE '✓ Removed duplicate enhanced-processing-job (if existed)';
    RAISE NOTICE '  - Eliminates redundant processing';
    RAISE NOTICE '  - Optimizes resource usage';
    RAISE NOTICE '';
    RAISE NOTICE 'OPTIMAL CRON JOB CONFIGURATION:';
    RAISE NOTICE '- aggregate-ratings-job: Every 5 minutes (rating processing)';
    RAISE NOTICE '- auto-generate-content-rules: Daily at 4 AM (rule generation)';
    RAISE NOTICE '- cleanup jobs: Daily maintenance';
    RAISE NOTICE '';
END;
$$;