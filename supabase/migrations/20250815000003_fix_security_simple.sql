-- Simple Security Fix: Add search_path protection to all functions
-- This approach drops and recreates functions to avoid signature conflicts

-- Drop all functions first to avoid conflicts
DROP FUNCTION IF EXISTS get_cache_statistics();
DROP FUNCTION IF EXISTS recalculate_with_new_config();
DROP FUNCTION IF EXISTS update_trust_config(TEXT, JSONB, TEXT);
DROP FUNCTION IF EXISTS get_trust_config(TEXT);
DROP FUNCTION IF EXISTS refresh_expired_domain_cache();
DROP FUNCTION IF EXISTS batch_aggregate_ratings();
DROP FUNCTION IF EXISTS calculate_enhanced_trust_score(TEXT, TEXT);
DROP FUNCTION IF EXISTS check_domain_blacklist(TEXT);
DROP FUNCTION IF EXISTS determine_content_type(TEXT, TEXT);
DROP FUNCTION IF EXISTS extract_domain(TEXT);

-- Recreate all functions with search_path protection

-- 1. extract_domain function
CREATE FUNCTION extract_domain(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $$
BEGIN
    RETURN regexp_replace(
        regexp_replace(url, '^https?://(www\.)?', '', 'i'),
        '/.*$', ''
    );
END;
$$;

-- 2. determine_content_type function
CREATE FUNCTION determine_content_type(url TEXT, domain TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
    rule_record RECORD;
BEGIN
    FOR rule_record IN 
        SELECT content_type, url_pattern 
        FROM public.content_type_rules 
        WHERE domain = determine_content_type.domain AND is_active = TRUE
        ORDER BY id
    LOOP
        IF rule_record.url_pattern IS NULL OR url ~ rule_record.url_pattern THEN
            RETURN rule_record.content_type;
        END IF;
    END LOOP;
    
    RETURN 'general';
END;
$$;

-- 3. check_domain_blacklist function
CREATE FUNCTION check_domain_blacklist(domain TEXT)
RETURNS TABLE(
    is_blacklisted BOOLEAN,
    blacklist_type TEXT,
    severity INTEGER,
    penalty_score DECIMAL
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
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
$$;

-- 4. calculate_enhanced_trust_score function
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
        COALESCE(AVG(rating), 3.0),
        COUNT(*) FILTER (WHERE is_spam = true),
        COUNT(*) FILTER (WHERE is_misleading = true),
        COUNT(*) FILTER (WHERE is_scam = true)
    INTO 
        v_total_ratings, v_avg_rating, v_spam_count, v_misleading_count, v_scam_count
    FROM public.ratings 
    WHERE url_hash = p_url_hash;
    
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
        FROM public.domain_cache 
        WHERE domain = v_domain AND cache_expires_at > NOW()
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
        
        SELECT COALESCE(trust_score_modifier, 0) INTO v_content_modifier
        FROM public.content_type_rules
        WHERE domain = v_domain AND content_type = v_content_type AND is_active = TRUE
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

-- 5. batch_aggregate_ratings function
CREATE FUNCTION batch_aggregate_ratings()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    processed_count INTEGER := 0;
    url_record RECORD;
    trust_scores RECORD;
BEGIN
    FOR url_record IN 
        SELECT DISTINCT url_hash 
        FROM public.ratings 
        WHERE processed = false
    LOOP
        SELECT * INTO trust_scores
        FROM public.calculate_enhanced_trust_score(url_record.url_hash, NULL);
        
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
            last_updated = EXCLUDED.last_updated;

        processed_count := processed_count + 1;
    END LOOP;

    UPDATE public.ratings SET processed = true WHERE processed = false;

    RETURN 'Enhanced processing completed for ' || processed_count || ' URLs';
END;
$$;

-- 6. refresh_expired_domain_cache function
CREATE FUNCTION refresh_expired_domain_cache()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.domain_cache 
    SET cache_expires_at = NOW() - INTERVAL '1 day'
    WHERE cache_expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN 'Marked ' || expired_count || ' domain cache entries as expired';
END;
$$;

-- 7. get_trust_config function
CREATE FUNCTION get_trust_config(config_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
DECLARE
    config_value JSONB;
BEGIN
    SELECT t.config_value INTO config_value
    FROM public.trust_algorithm_config t
    WHERE t.config_key = get_trust_config.config_key AND t.is_active = TRUE;
    
    RETURN COALESCE(config_value, '{}'::jsonb);
END;
$$;

-- 8. update_trust_config function
CREATE FUNCTION update_trust_config(
    p_config_key TEXT,
    p_config_value JSONB,
    p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
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
$$;

-- 9. recalculate_with_new_config function
CREATE FUNCTION recalculate_with_new_config()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    UPDATE public.ratings SET processed = false;
    
    UPDATE public.url_stats SET 
        final_trust_score = NULL,
        domain_trust_score = NULL,
        community_trust_score = NULL;
    
    RETURN public.batch_aggregate_ratings();
END;
$$;

-- 10. get_cache_statistics function
CREATE FUNCTION get_cache_statistics()
RETURNS TABLE(
    total_domains BIGINT,
    cached_domains BIGINT,
    expired_domains BIGINT,
    cache_hit_rate DECIMAL,
    avg_domain_age_days DECIMAL,
    ssl_valid_count BIGINT,
    google_threats_count BIGINT,
    hybrid_threats_count BIGINT
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
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
$$;