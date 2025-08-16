-- Fix redundant enhanced trust score calculations
-- This migration ensures enhanced scores are only calculated by cron job, not on every API call

-- Update the calculate_enhanced_trust_score function to be less verbose and more efficient
CREATE OR REPLACE FUNCTION calculate_enhanced_trust_score(
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
AS $
DECLARE
    v_domain TEXT;
    v_content_type TEXT;
    v_total_ratings INTEGER;
    v_avg_rating DECIMAL;
    v_spam_count INTEGER;
    v_misleading_count INTEGER;
    v_scam_count INTEGER;
    v_domain_trust DECIMAL := 50.0; -- Base domain trust score
    v_community_trust DECIMAL := 50.0; -- Base community trust score
    v_final_trust DECIMAL;
    v_blacklist_penalty DECIMAL := 0;
    v_content_modifier DECIMAL := 0;
    v_domain_cache_record RECORD;
    v_blacklist_record RECORD;
BEGIN
    -- Get URL if not provided (for existing records)
    IF p_url IS NULL THEN
        -- We'll need to store URLs in the future or pass them in
        -- For now, we'll work with what we have
        v_domain := 'unknown';
        v_content_type := 'general';
    ELSE
        v_domain := extract_domain(p_url);
        v_content_type := determine_content_type(p_url, v_domain);
    END IF;
    
    -- Get community ratings data
    SELECT 
        COUNT(*),
        COALESCE(AVG(rating), 3.0),
        COUNT(*) FILTER (WHERE is_spam = true),
        COUNT(*) FILTER (WHERE is_misleading = true),
        COUNT(*) FILTER (WHERE is_scam = true)
    INTO 
        v_total_ratings, v_avg_rating, v_spam_count, v_misleading_count, v_scam_count
    FROM ratings 
    WHERE url_hash = p_url_hash;
    
    -- Calculate community trust score (based on existing algorithm)
    IF v_total_ratings > 0 THEN
        -- Base score from ratings (1-5 scale to 0-100)
        v_community_trust := ((v_avg_rating - 1) / 4) * 100;
        
        -- Apply penalties for reports
        DECLARE
            spam_ratio DECIMAL := v_spam_count::DECIMAL / v_total_ratings;
            misleading_ratio DECIMAL := v_misleading_count::DECIMAL / v_total_ratings;
            scam_ratio DECIMAL := v_scam_count::DECIMAL / v_total_ratings;
        BEGIN
            v_community_trust := v_community_trust - (spam_ratio * 30);
            v_community_trust := v_community_trust - (misleading_ratio * 25);
            v_community_trust := v_community_trust - (scam_ratio * 40);
        END;
        
        -- Confidence adjustment based on sample size
        DECLARE
            confidence_multiplier DECIMAL := LEAST(1.0, v_total_ratings::DECIMAL / 5.0);
        BEGIN
            v_community_trust := v_community_trust * confidence_multiplier + (50 * (1 - confidence_multiplier));
        END;
    END IF;
    
    -- Calculate domain trust score (if domain is known)
    IF v_domain != 'unknown' THEN
        -- Check domain cache for external data
        SELECT * INTO v_domain_cache_record
        FROM domain_cache 
        WHERE domain = v_domain AND cache_expires_at > NOW()
        LIMIT 1;
        
        IF FOUND THEN
            -- Use cached domain data
            v_domain_trust := 50.0; -- Start with neutral
            
            -- Domain age bonus (older domains are generally more trustworthy)
            IF v_domain_cache_record.domain_age_days IS NOT NULL THEN
                IF v_domain_cache_record.domain_age_days > 365 * 5 THEN -- 5+ years
                    v_domain_trust := v_domain_trust + 15;
                ELSIF v_domain_cache_record.domain_age_days > 365 * 2 THEN -- 2+ years
                    v_domain_trust := v_domain_trust + 10;
                ELSIF v_domain_cache_record.domain_age_days > 365 THEN -- 1+ year
                    v_domain_trust := v_domain_trust + 5;
                ELSIF v_domain_cache_record.domain_age_days < 30 THEN -- Very new
                    v_domain_trust := v_domain_trust - 10;
                END IF;
            END IF;
            
            -- SSL certificate bonus
            IF v_domain_cache_record.ssl_valid = TRUE THEN
                v_domain_trust := v_domain_trust + 5;
            ELSE
                v_domain_trust := v_domain_trust - 15;
            END IF;
            
            -- HTTP status penalties
            IF v_domain_cache_record.http_status >= 400 THEN
                v_domain_trust := v_domain_trust - 20;
            END IF;
            
            -- Google Safe Browsing penalties
            CASE v_domain_cache_record.google_safe_browsing_status
                WHEN 'malware' THEN v_domain_trust := v_domain_trust - 50;
                WHEN 'phishing' THEN v_domain_trust := v_domain_trust - 45;
                WHEN 'unwanted' THEN v_domain_trust := v_domain_trust - 30;
                ELSE NULL; -- 'safe' or null, no penalty
            END CASE;
            
            -- Hybrid Analysis penalties
            CASE v_domain_cache_record.hybrid_analysis_status
                WHEN 'malicious' THEN v_domain_trust := v_domain_trust - 40;
                WHEN 'suspicious' THEN v_domain_trust := v_domain_trust - 25;
                ELSE NULL; -- 'clean' or null, no penalty
            END CASE;
        END IF;
        
        -- Check blacklist
        SELECT * INTO v_blacklist_record
        FROM check_domain_blacklist(v_domain);
        
        IF v_blacklist_record.is_blacklisted THEN
            v_blacklist_penalty := v_blacklist_record.penalty_score;
            v_domain_trust := v_domain_trust - v_blacklist_penalty;
        END IF;
        
        -- Get content type modifier
        SELECT COALESCE(trust_score_modifier, 0) INTO v_content_modifier
        FROM content_type_rules
        WHERE domain = v_domain AND content_type = v_content_type AND is_active = TRUE
        LIMIT 1;
        
        v_domain_trust := v_domain_trust + v_content_modifier;
    END IF;
    
    -- Ensure scores are within bounds
    v_domain_trust := GREATEST(0, LEAST(100, v_domain_trust));
    v_community_trust := GREATEST(0, LEAST(100, v_community_trust));
    
    -- Calculate final trust score (weighted average)
    -- 40% domain factors, 60% community ratings
    v_final_trust := (v_domain_trust * 0.4) + (v_community_trust * 0.6);
    
    -- Ensure final score is within bounds
    v_final_trust := GREATEST(0, LEAST(100, v_final_trust));
    
    -- Only log during cron job execution (when called from batch_aggregate_ratings)
    -- Remove the verbose logging that was causing spam
    
    RETURN QUERY SELECT 
        ROUND(v_domain_trust, 2),
        ROUND(v_community_trust, 2),
        ROUND(v_final_trust, 2),
        v_content_type;
END;
$;

-- Update batch_aggregate_ratings to only process truly unprocessed ratings
CREATE OR REPLACE FUNCTION batch_aggregate_ratings()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
    processed_count INTEGER := 0;
    url_record RECORD;
    trust_scores RECORD;
BEGIN
    -- Only process URLs with unprocessed ratings (this should be the only place enhanced scores are calculated)
    FOR url_record IN 
        SELECT DISTINCT url_hash 
        FROM ratings 
        WHERE processed = false
    LOOP
        -- Calculate enhanced trust scores only for URLs with unprocessed ratings
        SELECT * INTO trust_scores
        FROM calculate_enhanced_trust_score(url_record.url_hash, NULL);
        
        -- Get basic stats
        WITH stats AS (
            SELECT 
                COUNT(*) as total_ratings,
                AVG(rating) as avg_rating,
                COUNT(*) FILTER (WHERE is_spam = true) as spam_count,
                COUNT(*) FILTER (WHERE is_misleading = true) as misleading_count,
                COUNT(*) FILTER (WHERE is_scam = true) as scam_count
            FROM ratings 
            WHERE url_hash = url_record.url_hash
        )
        -- Upsert enhanced url_stats
        INSERT INTO url_stats (
            url_hash,
            trust_score, -- Keep for backward compatibility
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

    -- Mark all ratings as processed
    UPDATE ratings SET processed = true WHERE processed = false;

    -- Only log when actually processing ratings
    IF processed_count > 0 THEN
        RAISE NOTICE 'Enhanced processing completed for % URLs with unprocessed ratings', processed_count;
    END IF;

    RETURN 'Enhanced processing completed for ' || processed_count || ' URLs';
END;
$;

-- Add a function to check if enhanced scores exist for a URL (to avoid recalculation)
CREATE OR REPLACE FUNCTION has_enhanced_scores(p_url_hash TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
AS $
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM url_stats 
        WHERE url_hash = p_url_hash 
        AND final_trust_score IS NOT NULL 
        AND domain_trust_score IS NOT NULL
    );
END;
$;

COMMENT ON FUNCTION calculate_enhanced_trust_score IS 'Calculates enhanced trust scores - should only be called by cron job';
COMMENT ON FUNCTION batch_aggregate_ratings IS 'Cron job function - processes unprocessed ratings only';
COMMENT ON FUNCTION has_enhanced_scores IS 'Checks if URL already has enhanced scores to avoid recalculation';