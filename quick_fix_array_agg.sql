-- Quick fix for array_agg syntax error
-- This just updates the function definition to fix the PostgreSQL syntax issue

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
            -- Sample URLs to analyze patterns (FIXED: removed DISTINCT to allow ORDER BY)
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
    
    -- Count total active rules
    SELECT COUNT(*) INTO rule_count FROM public.content_type_rules WHERE is_active = true;
    
    RAISE NOTICE 'Content type rule generation completed: % new rules created, % total active rules', 
        new_rules_count, rule_count;
    
    RETURN 'Content type rules updated. New rules: ' || new_rules_count || ', Total active rules: ' || rule_count;
END;
$$;