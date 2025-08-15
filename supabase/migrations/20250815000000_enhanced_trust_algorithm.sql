-- Enhanced Trust Score Algorithm with External Data Sources
-- This migration adds support for domain analysis, blacklists, and content-specific scoring

-- Create domain_cache table for expensive API calls
CREATE TABLE domain_cache (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT UNIQUE NOT NULL,
  domain_age_days INTEGER,
  whois_data JSONB,
  http_status INTEGER,
  ssl_valid BOOLEAN,
  google_safe_browsing_status TEXT, -- 'safe', 'malware', 'phishing', 'unwanted'
  phishtank_status TEXT, -- 'clean', 'phishing', 'suspicious'
  last_checked TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  cache_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days'),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create blacklist table for known bad domains/patterns
CREATE TABLE domain_blacklist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain_pattern TEXT NOT NULL, -- Can be exact domain or pattern like '*.badsite.com'
  blacklist_type TEXT NOT NULL, -- 'malware', 'phishing', 'spam', 'scam', 'adult', 'gambling'
  severity INTEGER NOT NULL CHECK (severity >= 1 AND severity <= 10), -- 1=low, 10=critical
  source TEXT NOT NULL, -- 'manual', 'google_safe_browsing', 'phishtank', 'community'
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create content_type_rules table for handling different content types
CREATE TABLE content_type_rules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL,
  content_type TEXT NOT NULL, -- 'article', 'video', 'profile', 'product', 'general'
  url_pattern TEXT, -- Regex pattern to identify content type
  trust_score_modifier DECIMAL(5,2) DEFAULT 0, -- Modifier to base trust score
  min_ratings_required INTEGER DEFAULT 3, -- Minimum ratings needed for this content type
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add content-specific columns to url_stats
ALTER TABLE url_stats ADD COLUMN IF NOT EXISTS domain TEXT;
ALTER TABLE url_stats ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'general';
ALTER TABLE url_stats ADD COLUMN IF NOT EXISTS domain_trust_score DECIMAL(5,2);
ALTER TABLE url_stats ADD COLUMN IF NOT EXISTS community_trust_score DECIMAL(5,2);
ALTER TABLE url_stats ADD COLUMN IF NOT EXISTS final_trust_score DECIMAL(5,2);
ALTER TABLE url_stats ADD COLUMN IF NOT EXISTS average_rating DECIMAL(3,2);

-- Create indexes for performance
CREATE INDEX idx_domain_cache_domain ON domain_cache(domain);
CREATE INDEX idx_domain_cache_expires ON domain_cache(cache_expires_at);
CREATE INDEX idx_blacklist_domain ON domain_blacklist(domain_pattern);
CREATE INDEX idx_blacklist_active ON domain_blacklist(is_active);
CREATE INDEX idx_content_rules_domain ON content_type_rules(domain);
CREATE INDEX idx_url_stats_domain ON url_stats(domain);

-- Insert default content type rules for major platforms
INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier, min_ratings_required, description) VALUES
('youtube.com', 'video', '/watch\?v=', 5, 2, 'YouTube videos - slight trust bonus for established platform'),
('wikipedia.org', 'article', '/wiki/', 10, 1, 'Wikipedia articles - high trust bonus for educational content'),
('reddit.com', 'discussion', '/r/.*/(comments|post)', 0, 3, 'Reddit posts - neutral modifier, require more ratings'),
('twitter.com', 'social', '/(.*)/status/', -2, 5, 'Twitter posts - slight penalty, require more ratings'),
('x.com', 'social', '/(.*)/status/', -2, 5, 'X (Twitter) posts - slight penalty, require more ratings'),
('linkedin.com', 'professional', '/in/|/company/', 3, 2, 'LinkedIn profiles - slight trust bonus'),
('github.com', 'code', '/.*/.*/.*', 5, 2, 'GitHub repositories - trust bonus for open source'),
('stackoverflow.com', 'qa', '/questions/', 8, 1, 'Stack Overflow - high trust for technical Q&A'),
('medium.com', 'article', '/@.*/', 2, 3, 'Medium articles - slight trust bonus'),
('news.ycombinator.com', 'discussion', '/item\?id=', 5, 2, 'Hacker News - trust bonus for tech community');

-- Function to extract domain from URL
CREATE OR REPLACE FUNCTION extract_domain(url TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    -- Remove protocol and www, extract domain
    RETURN regexp_replace(
        regexp_replace(url, '^https?://(www\.)?', '', 'i'),
        '/.*$', ''
    );
END;
$$;

-- Function to determine content type based on URL and rules
CREATE OR REPLACE FUNCTION determine_content_type(url TEXT, domain TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    rule_record RECORD;
BEGIN
    -- Check content type rules for this domain
    FOR rule_record IN 
        SELECT content_type, url_pattern 
        FROM content_type_rules 
        WHERE domain = domain AND is_active = TRUE
        ORDER BY id
    LOOP
        IF rule_record.url_pattern IS NULL OR url ~ rule_record.url_pattern THEN
            RETURN rule_record.content_type;
        END IF;
    END LOOP;
    
    -- Default to general if no rules match
    RETURN 'general';
END;
$$;

-- Function to check domain against blacklists
CREATE OR REPLACE FUNCTION check_domain_blacklist(domain TEXT)
RETURNS TABLE(
    is_blacklisted BOOLEAN,
    blacklist_type TEXT,
    severity INTEGER,
    penalty_score DECIMAL
)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    max_severity INTEGER := 0;
    worst_type TEXT := NULL;
    total_penalty DECIMAL := 0;
BEGIN
    -- Check exact domain matches and patterns
    SELECT 
        COALESCE(MAX(b.severity), 0),
        (SELECT b2.blacklist_type FROM domain_blacklist b2 WHERE b2.is_active AND (b2.domain_pattern = domain OR domain LIKE b2.domain_pattern) ORDER BY b2.severity DESC LIMIT 1),
        COALESCE(SUM(b.severity * 5), 0) -- 5 points penalty per severity level
    INTO max_severity, worst_type, total_penalty
    FROM domain_blacklist b
    WHERE b.is_active AND (b.domain_pattern = domain OR domain LIKE b.domain_pattern);
    
    RETURN QUERY SELECT 
        max_severity > 0,
        worst_type,
        max_severity,
        LEAST(total_penalty, 50.0); -- Cap penalty at 50 points
END;
$$;

-- Enhanced trust score calculation function
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
AS $$
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
            
            -- PhishTank penalties
            CASE v_domain_cache_record.phishtank_status
                WHEN 'phishing' THEN v_domain_trust := v_domain_trust - 40;
                WHEN 'suspicious' THEN v_domain_trust := v_domain_trust - 20;
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
    
    RETURN QUERY SELECT 
        ROUND(v_domain_trust, 2),
        ROUND(v_community_trust, 2),
        ROUND(v_final_trust, 2),
        v_content_type;
END;
$$;

-- Enhanced batch aggregation function
CREATE OR REPLACE FUNCTION enhanced_batch_aggregate_ratings()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    processed_count INTEGER := 0;
    url_record RECORD;
    trust_scores RECORD;
BEGIN
    -- Process all URLs with unprocessed ratings
    FOR url_record IN 
        SELECT DISTINCT url_hash 
        FROM ratings 
        WHERE processed = false
    LOOP
        -- Calculate enhanced trust scores
        SELECT * INTO trust_scores
        FROM calculate_enhanced_trust_score(url_record.url_hash);
        
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

    RETURN 'Enhanced processing completed for ' || processed_count || ' URLs';
END;
$$;

-- Update the cron job to use enhanced function
SELECT cron.unschedule('aggregate-ratings-job');
SELECT cron.schedule(
    'enhanced-aggregate-ratings-job',
    '*/5 * * * *',
    'SELECT enhanced_batch_aggregate_ratings();'
);

-- Function to refresh domain cache (call this periodically)
CREATE OR REPLACE FUNCTION refresh_expired_domain_cache()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    -- This function should be called by external service to update domain data
    -- For now, just mark expired entries
    UPDATE domain_cache 
    SET cache_expires_at = NOW() - INTERVAL '1 day'
    WHERE cache_expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN 'Marked ' || expired_count || ' domain cache entries as expired';
END;
$$;

-- Create view for trust score analytics with new dimensions
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
FROM url_stats 
WHERE final_trust_score IS NOT NULL
GROUP BY content_type, score_category
ORDER BY content_type, avg_final_score DESC;

-- Comments
COMMENT ON TABLE domain_cache IS 'Caches expensive external API calls for domain analysis';
COMMENT ON TABLE domain_blacklist IS 'Stores known malicious domains and patterns';
COMMENT ON TABLE content_type_rules IS 'Rules for handling different content types (articles, videos, etc.)';
COMMENT ON FUNCTION calculate_enhanced_trust_score IS 'Main enhanced trust score calculation with domain and content analysis';
COMMENT ON FUNCTION enhanced_batch_aggregate_ratings IS 'Enhanced batch processing with multi-factor trust scoring';