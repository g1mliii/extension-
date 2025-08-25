-- Test the content rule generation function
-- First, let's recreate it and then test it

-- Recreate the auto_generate_content_type_rules function (the correct one from Task 19)
CREATE OR REPLACE FUNCTION auto_generate_content_type_rules()
RETURNS TEXT AS $$
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
            AVG(r.score) as avg_rating,
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
        
        -- Default case for other domains
        ELSE
            content_type_detected := 'general';
            trust_modifier := 0;
            min_ratings := 3;
            rule_description := 'General domain - standard validation';
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION auto_generate_content_type_rules() TO authenticated;
GRANT EXECUTE ON FUNCTION auto_generate_content_type_rules() TO service_role;

-- Test the function
SELECT 'Testing content rule generation:' as info;
SELECT auto_generate_content_type_rules();