-- Fix Function Parameter Ambiguity
-- The determine_content_type function has ambiguous column references

-- Drop and recreate the function with proper parameter naming
DROP FUNCTION IF EXISTS determine_content_type(TEXT, TEXT);

CREATE FUNCTION determine_content_type(p_url TEXT, p_domain TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
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
$$;

-- Also fix the calculate_enhanced_trust_score function to use the correct parameter names
DROP FUNCTION IF EXISTS calculate_enhanced_trust_score(TEXT, TEXT);

CREATE FUNCTION calculate_enhanced_trust_score(
    p_url_hash TEXT,
    p_url TEXT DEFAULT NULL
)
RETURNS TABLE(
    domain_score DECIMAL,
    community_score DECIMAL,
    final_score DECIMAL,
    content_type TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- Comments
COMMENT ON FUNCTION determine_content_type IS 'Determines content type - FIXED: Parameter ambiguity resolved';
COMMENT ON FUNCTION calculate_enhanced_trust_score IS 'Enhanced trust calculation - FIXED: Parameter ambiguity resolved';