auto_generate_content_rules
DECLARE
    rule_count INTEGER := 0;
BEGIN
    -- Add major platforms automatically (using individual INSERT statements to avoid conflicts)
    
    -- Social Media Platforms
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'facebook.com', 'social', '/.*/(posts|photos)/', -1, 5, 'Facebook posts - require more validation', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'facebook.com' AND content_type = 'social');
    
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'instagram.com', 'social', '/p/', -1, 4, 'Instagram posts', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'instagram.com' AND content_type = 'social');
    
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'tiktok.com', 'social', '/@.*/', -2, 6, 'TikTok videos - high variability', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'tiktok.com' AND content_type = 'social');
    
    -- News & Media
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'cnn.com', 'news', '/.*/', 8, 2, 'CNN news articles - established source', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'cnn.com' AND content_type = 'news');
    
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'bbc.com', 'news', '/news/', 9, 2, 'BBC news - high trust', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'bbc.com' AND content_type = 'news');
    
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'reuters.com', 'news', '/.*/', 9, 2, 'Reuters - high credibility', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'reuters.com' AND content_type = 'news');
    
    -- Educational
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'coursera.org', 'education', '/learn/', 7, 2, 'Coursera courses', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'coursera.org' AND content_type = 'education');
    
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'mit.edu', 'education', '/.*/', 9, 1, 'MIT - academic institution', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'mit.edu' AND content_type = 'education');
    
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'stanford.edu', 'education', '/.*/', 9, 1, 'Stanford - academic institution', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'stanford.edu' AND content_type = 'education');
    
    -- Tech Documentation
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'developer.mozilla.org', 'documentation', '/.*/', 8, 2, 'MDN - web standards', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'developer.mozilla.org' AND content_type = 'documentation');
    
    -- E-commerce
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'amazon.com', 'ecommerce', '/dp/|/gp/product/', 2, 3, 'Amazon products', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'amazon.com' AND content_type = 'ecommerce');
    
    -- Entertainment
    INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description, is_active)
    SELECT 'netflix.com', 'entertainment', '/title/', 3, 3, 'Netflix content', true
    WHERE NOT EXISTS (SELECT 1 FROM content_type_rules WHERE domain = 'netflix.com' AND content_type = 'entertainment');
    
    -- Count total rules
    SELECT COUNT(*) INTO rule_count FROM content_type_rules WHERE is_active = true;
    
    RETURN 'Content type rules updated. Total active rules: ' || rule_count;
END;

next function 
batch_aggregate_ratings

DECLARE
    processed_count INTEGER := 0;
    url_record RECORD;
    trust_scores RECORD;
    v_domain TEXT;
    v_domain_cache_exists BOOLEAN;
    v_blacklist_checked BOOLEAN;
    v_external_apis_checked BOOLEAN;
BEGIN
    FOR url_record IN 
        SELECT DISTINCT url_hash 
        FROM public.ratings 
        WHERE processed = false
    LOOP
        -- Calculate enhanced trust scores
        SELECT * INTO trust_scores
        FROM public.calculate_enhanced_trust_score(url_record.url_hash, NULL);
        
        -- Determine processing status details
        SELECT domain INTO v_domain FROM public.url_stats WHERE url_hash = url_record.url_hash;
        
        -- Check if domain analysis is available
        v_domain_cache_exists := EXISTS(
            SELECT 1 FROM public.domain_cache 
            WHERE domain = v_domain AND cache_expires_at > NOW()
        );
        
        v_blacklist_checked := v_domain IS NOT NULL;
        v_external_apis_checked := v_domain_cache_exists;
        
        -- Get basic stats and update with processing status
        WITH stats AS (
            SELECT 
                COUNT(*) as total_ratings,
                AVG(rating) as avg_rating,
                COUNT(*) FILTER (WHERE is_spam = true) as spam_count,
                COUNT(*) FILTER (WHERE is_misleading = true) as misleading_count,
                COUNT(*) FILTER (WHERE is_scam = true) as scam_count
            FROM public.ratings 
            WHERE url_hash = url_record.url_hash
        )
        INSERT INTO public.url_stats (
            url_hash,
            trust_score,
            final_trust_score,
            domain_trust_score,
            community_trust_score,
            content_type,
            rating_count,
            average_rating,
            spam_reports_count,
            misleading_reports_count,
            scam_reports_count,
            processing_status,
            domain_analysis_processed,
            last_updated
        )
        SELECT 
            url_record.url_hash,
            trust_scores.final_score,
            trust_scores.final_score,
            trust_scores.domain_score,
            trust_scores.community_score,
            trust_scores.content_type,
            s.total_ratings,
            ROUND(s.avg_rating, 2),
            s.spam_count,
            s.misleading_count,
            s.scam_count,
            CASE 
                WHEN v_external_apis_checked THEN 'enhanced_with_domain_analysis'
                WHEN v_domain IS NOT NULL THEN 'community_with_basic_domain'
                ELSE 'community_only'
            END,
            v_external_apis_checked,
            NOW()
        FROM stats s
        ON CONFLICT (url_hash) 
        DO UPDATE SET
            trust_score = EXCLUDED.trust_score,
            final_trust_score = EXCLUDED.final_trust_score,
            domain_trust_score = EXCLUDED.domain_trust_score,
            community_trust_score = EXCLUDED.community_trust_score,
            content_type = EXCLUDED.content_type,
            rating_count = EXCLUDED.rating_count,
            average_rating = EXCLUDED.average_rating,
            spam_reports_count = EXCLUDED.spam_reports_count,
            misleading_reports_count = EXCLUDED.misleading_reports_count,
            scam_reports_count = EXCLUDED.scam_reports_count,
            processing_status = EXCLUDED.processing_status,
            domain_analysis_processed = EXCLUDED.domain_analysis_processed,
            last_updated = EXCLUDED.last_updated;

        processed_count := processed_count + 1;
    END LOOP;

    -- Mark all ratings as processed
    UPDATE public.ratings SET processed = true WHERE processed = false;

    RETURN 'Enhanced processing completed for ' || processed_count || ' URLs with status tracking';
END;

Next function calculate_enhanced_trust_score

DECLARE
    v_domain TEXT;
    v_content_type TEXT;
    v_total_ratings INTEGER;
    v_avg_rating DECIMAL;
    v_spam_count INTEGER;
    v_misleading_count INTEGER;
    v_scam_count INTEGER;
    v_domain_trust DECIMAL := 50.0;
    v_community_trust DECIMAL := 50.0;
    v_final_trust DECIMAL;
    v_blacklist_penalty DECIMAL := 0;
    v_content_modifier DECIMAL := 0;
    v_domain_cache_record RECORD;
    v_blacklist_record RECORD;
BEGIN
    IF p_url IS NULL THEN
        v_domain := 'unknown';
        v_content_type := 'general';
    ELSE
        v_domain := public.extract_domain(p_url);
        v_content_type := public.determine_content_type(p_url, v_domain);
    END IF;
    
    SELECT 
        COUNT(*),
        COALESCE(AVG(r.rating), 3.0),
        COUNT(*) FILTER (WHERE r.is_spam = true),
        COUNT(*) FILTER (WHERE r.is_misleading = true),
        COUNT(*) FILTER (WHERE r.is_scam = true)
    INTO 
        v_total_ratings, v_avg_rating, v_spam_count, v_misleading_count, v_scam_count
    FROM public.ratings r
    WHERE r.url_hash = p_url_hash;
    
    IF v_total_ratings > 0 THEN
        v_community_trust := ((v_avg_rating - 1) / 4) * 100;
        
        DECLARE
            spam_ratio DECIMAL := v_spam_count::DECIMAL / v_total_ratings;
            misleading_ratio DECIMAL := v_misleading_count::DECIMAL / v_total_ratings;
            scam_ratio DECIMAL := v_scam_count::DECIMAL / v_total_ratings;
        BEGIN
            v_community_trust := v_community_trust - (spam_ratio * 30);
            v_community_trust := v_community_trust - (misleading_ratio * 25);
            v_community_trust := v_community_trust - (scam_ratio * 40);
        END;
        
        DECLARE
            confidence_multiplier DECIMAL := LEAST(1.0, v_total_ratings::DECIMAL / 5.0);
        BEGIN
            v_community_trust := v_community_trust * confidence_multiplier + (50 * (1 - confidence_multiplier));
        END;
    END IF;
    
    IF v_domain != 'unknown' THEN
        SELECT * INTO v_domain_cache_record
        FROM public.domain_cache dc
        WHERE dc.domain = v_domain AND dc.cache_expires_at > NOW()
        LIMIT 1;
        
        IF FOUND THEN
            v_domain_trust := 50.0;
            
            IF v_domain_cache_record.domain_age_days IS NOT NULL THEN
                IF v_domain_cache_record.domain_age_days > 365 * 5 THEN
                    v_domain_trust := v_domain_trust + 15;
                ELSIF v_domain_cache_record.domain_age_days > 365 * 2 THEN
                    v_domain_trust := v_domain_trust + 10;
                ELSIF v_domain_cache_record.domain_age_days > 365 THEN
                    v_domain_trust := v_domain_trust + 5;
                ELSIF v_domain_cache_record.domain_age_days < 30 THEN
                    v_domain_trust := v_domain_trust - 10;
                END IF;
            END IF;
            
            IF v_domain_cache_record.ssl_valid = TRUE THEN
                v_domain_trust := v_domain_trust + 5;
            ELSE
                v_domain_trust := v_domain_trust - 15;
            END IF;
            
            IF v_domain_cache_record.http_status >= 400 THEN
                v_domain_trust := v_domain_trust - 20;
            END IF;
            
            CASE v_domain_cache_record.google_safe_browsing_status
                WHEN 'malware' THEN v_domain_trust := v_domain_trust - 50;
                WHEN 'phishing' THEN v_domain_trust := v_domain_trust - 45;
                WHEN 'unwanted' THEN v_domain_trust := v_domain_trust - 30;
                ELSE NULL;
            END CASE;
            
            CASE v_domain_cache_record.hybrid_analysis_status
                WHEN 'malicious' THEN v_domain_trust := v_domain_trust - 40;
                WHEN 'suspicious' THEN v_domain_trust := v_domain_trust - 25;
                ELSE NULL;
            END CASE;
        END IF;
        
        SELECT * INTO v_blacklist_record
        FROM public.check_domain_blacklist(v_domain);
        
        IF v_blacklist_record.is_blacklisted THEN
            v_blacklist_penalty := v_blacklist_record.penalty_score;
            v_domain_trust := v_domain_trust - v_blacklist_penalty;
        END IF;
        
        SELECT COALESCE(ctr.trust_score_modifier, 0) INTO v_content_modifier
        FROM public.content_type_rules ctr
        WHERE ctr.domain = v_domain AND ctr.content_type = v_content_type AND ctr.is_active = TRUE
        LIMIT 1;
        
        v_domain_trust := v_domain_trust + v_content_modifier;
    END IF;
    
    v_domain_trust := GREATEST(0, LEAST(100, v_domain_trust));
    v_community_trust := GREATEST(0, LEAST(100, v_community_trust));
    
    v_final_trust := (v_domain_trust * 0.4) + (v_community_trust * 0.6);
    v_final_trust := GREATEST(0, LEAST(100, v_final_trust));
    
    RETURN QUERY SELECT 
        ROUND(v_domain_trust, 2),
        ROUND(v_community_trust, 2),
        ROUND(v_final_trust, 2),
        v_content_type;
END;

next function check_domain_blacklist

DECLARE
    max_severity INTEGER := 0;
    worst_type TEXT := NULL;
    total_penalty DECIMAL := 0;
BEGIN
    SELECT 
        COALESCE(MAX(b.severity), 0),
        (SELECT b2.blacklist_type FROM public.domain_blacklist b2 WHERE b2.is_active AND (b2.domain_pattern = domain OR domain LIKE b2.domain_pattern) ORDER BY b2.severity DESC LIMIT 1),
        COALESCE(SUM(b.severity * 5), 0)
    INTO max_severity, worst_type, total_penalty
    FROM public.domain_blacklist b
    WHERE b.is_active AND (b.domain_pattern = domain OR domain LIKE b.domain_pattern);
    
    RETURN QUERY SELECT 
        max_severity > 0,
        worst_type,
        max_severity,
        LEAST(total_penalty, 50.0);
END;

Next function cleanup_old_urls

DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM public.url_stats 
    WHERE last_accessed < NOW() - INTERVAL '1 month' * months_old;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN 'Deleted ' || deleted_count || ' URLs not accessed in ' || months_old || ' months';
END;

Next funtion determine_content_type

DECLARE
    rule_record RECORD;
BEGIN
    -- Check content type rules for this domain
    FOR rule_record IN 
        SELECT ctr.content_type, ctr.url_pattern 
        FROM public.content_type_rules ctr
        WHERE ctr.domain = p_domain AND ctr.is_active = TRUE
        ORDER BY ctr.id
    LOOP
        IF rule_record.url_pattern IS NULL OR p_url ~ rule_record.url_pattern THEN
            RETURN rule_record.content_type;
        END IF;
    END LOOP;
    
    -- Default to general if no rules match
    RETURN 'general';
END;

Next function extract_domain

BEGIN
    RETURN regexp_replace(
        regexp_replace(url, '^https?://(www\.)?', '', 'i'),
        '/.*$', ''
    );
END;

Next function get_cache_statistics

BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_domains,
        COUNT(*) FILTER (WHERE cache_expires_at > NOW()) as cached_domains,
        COUNT(*) FILTER (WHERE cache_expires_at <= NOW()) as expired_domains,
        ROUND(
            COUNT(*) FILTER (WHERE cache_expires_at > NOW()) * 100.0 / 
            NULLIF(COUNT(*), 0), 2
        ) as cache_hit_rate,
        ROUND(AVG(domain_age_days), 1) as avg_domain_age_days,
        COUNT(*) FILTER (WHERE ssl_valid = true) as ssl_valid_count,
        COUNT(*) FILTER (WHERE google_safe_browsing_status IN ('malware', 'phishing', 'unwanted')) as google_threats_count,
        COUNT(*) FILTER (WHERE hybrid_analysis_status IN ('malicious', 'suspicious')) as hybrid_threats_count
    FROM public.domain_cache;
END;
Next function get_enhanced_trust_analytics
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

Next function get_processing_status_summary

BEGIN
    RETURN QUERY
    WITH status_counts AS (
        SELECT 
            u.processing_status,
            COUNT(*) as count_total
        FROM public.url_stats u
        GROUP BY u.processing_status
    ),
    total_count AS (
        SELECT SUM(count_total) as total FROM status_counts
    )
    SELECT 
        sc.processing_status,
        sc.count_total,
        ROUND(sc.count_total * 100.0 / tc.total, 2) as percentage
    FROM status_counts sc
    CROSS JOIN total_count tc
    ORDER BY sc.count_total DESC;
END;

Next function get_trust_algorithm_performance

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

Next function get_trust_config

DECLARE
    config_value JSONB;
BEGIN
    SELECT t.config_value INTO config_value
    FROM public.trust_algorithm_config t
    WHERE t.config_key = get_trust_config.config_key AND t.is_active = TRUE;
    
    RETURN COALESCE(config_value, '{}'::jsonb);
END;

Next function recalculate_with_new_config

BEGIN
    UPDATE public.ratings SET processed = false;
    
    UPDATE public.url_stats SET 
        final_trust_score = NULL,
        domain_trust_score = NULL,
        community_trust_score = NULL;
    
    RETURN public.batch_aggregate_ratings();
END;

next function refresh_expired_domain_cache

DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.domain_cache 
    SET cache_expires_at = NOW() - INTERVAL '1 day'
    WHERE cache_expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN 'Marked ' || expired_count || ' domain cache entries as expired';
END;

next function update_trust_config

BEGIN
    INSERT INTO public.trust_algorithm_config (config_key, config_value, description, updated_at)
    VALUES (p_config_key, p_config_value, p_description, NOW())
    ON CONFLICT (config_key)
    DO UPDATE SET
        config_value = EXCLUDED.config_value,
        description = COALESCE(EXCLUDED.description, public.trust_algorithm_config.description),
        updated_at = EXCLUDED.updated_at;
    
    RETURN TRUE;
END;
