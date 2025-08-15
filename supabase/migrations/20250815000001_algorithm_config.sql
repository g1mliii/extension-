-- Trust Algorithm Configuration
-- This file contains configurable parameters for the trust scoring algorithm

-- Create configuration table for algorithm parameters
CREATE TABLE trust_algorithm_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  config_key TEXT UNIQUE NOT NULL,
  config_value JSONB NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration values
INSERT INTO trust_algorithm_config (config_key, config_value, description) VALUES
('scoring_weights', '{
  "domain_weight": 0.4,
  "community_weight": 0.6
}', 'Weights for combining domain and community scores'),

('domain_scoring', '{
  "base_score": 50,
  "domain_age_bonus": {
    "5_years_plus": 15,
    "2_years_plus": 10,
    "1_year_plus": 5,
    "new_domain_penalty": -10
  },
  "ssl_bonus": 5,
  "ssl_penalty": -15,
  "http_error_penalty": -20,
  "google_safe_browsing_penalties": {
    "malware": -50,
    "phishing": -45,
    "unwanted": -30
  },
  "phishtank_penalties": {
    "phishing": -40,
    "suspicious": -20
  }
}', 'Domain-based scoring parameters'),

('community_scoring', '{
  "base_multiplier": 100,
  "report_penalties": {
    "spam_penalty_percent": 30,
    "misleading_penalty_percent": 25,
    "scam_penalty_percent": 40
  },
  "confidence_adjustment": {
    "min_ratings_for_full_confidence": 5,
    "neutral_score_for_low_confidence": 50
  }
}', 'Community rating scoring parameters'),

('content_type_modifiers', '{
  "article": 2,
  "video": 1,
  "social": -2,
  "professional": 3,
  "code": 5,
  "qa": 8,
  "discussion": 0,
  "general": 0
}', 'Trust score modifiers by content type'),

('blacklist_penalties', '{
  "max_penalty": 50,
  "severity_multiplier": 5
}', 'Blacklist penalty configuration'),

('cache_settings', '{
  "domain_cache_days": 7,
  "batch_analysis_limit": 10,
  "analysis_concurrency": 3,
  "analysis_delay_ms": 1000
}', 'Caching and analysis settings');

-- Create function to get configuration values
CREATE OR REPLACE FUNCTION get_trust_config(config_key TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    config_value JSONB;
BEGIN
    SELECT t.config_value INTO config_value
    FROM trust_algorithm_config t
    WHERE t.config_key = get_trust_config.config_key AND t.is_active = TRUE;
    
    RETURN COALESCE(config_value, '{}'::jsonb);
END;
$$;

-- Create function to update configuration
CREATE OR REPLACE FUNCTION update_trust_config(
    p_config_key TEXT,
    p_config_value JSONB,
    p_description TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO trust_algorithm_config (config_key, config_value, description, updated_at)
    VALUES (p_config_key, p_config_value, p_description, NOW())
    ON CONFLICT (config_key)
    DO UPDATE SET
        config_value = EXCLUDED.config_value,
        description = COALESCE(EXCLUDED.description, trust_algorithm_config.description),
        updated_at = EXCLUDED.updated_at;
    
    RETURN TRUE;
END;
$$;

-- Insert some sample blacklist entries
INSERT INTO domain_blacklist (domain_pattern, blacklist_type, severity, source, description) VALUES
('*.phishing-example.com', 'phishing', 10, 'manual', 'Known phishing domain pattern'),
('malware-test.com', 'malware', 9, 'manual', 'Test malware domain'),
('*.spam-ads.net', 'spam', 6, 'manual', 'Spam advertising network'),
('scam-crypto.org', 'scam', 10, 'manual', 'Cryptocurrency scam site'),
('fake-bank.com', 'phishing', 10, 'manual', 'Fake banking site');

-- Create view for algorithm performance monitoring
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
FROM url_stats 
WHERE final_trust_score IS NOT NULL
  AND last_updated >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', last_updated), content_type
ORDER BY date DESC, content_type;

-- Create function to recalculate scores with new configuration
CREATE OR REPLACE FUNCTION recalculate_with_new_config()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark all ratings as unprocessed to force recalculation
    UPDATE ratings SET processed = false;
    
    -- Clear existing calculated scores to force fresh calculation
    UPDATE url_stats SET 
        final_trust_score = NULL,
        domain_trust_score = NULL,
        community_trust_score = NULL;
    
    -- Run the enhanced aggregation
    RETURN enhanced_batch_aggregate_ratings();
END;
$$;

-- Comments
COMMENT ON TABLE trust_algorithm_config IS 'Configurable parameters for the trust scoring algorithm';
COMMENT ON FUNCTION get_trust_config IS 'Retrieves configuration values for the trust algorithm';
COMMENT ON FUNCTION update_trust_config IS 'Updates configuration values and triggers recalculation if needed';
COMMENT ON VIEW trust_algorithm_performance IS 'Monitors algorithm performance over time';
COMMENT ON FUNCTION recalculate_with_new_config IS 'Recalculates all trust scores after configuration changes';