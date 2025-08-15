-- Trust Score Configuration Table
-- This allows you to modify scoring parameters without changing code

CREATE TABLE trust_score_config (
    id SERIAL PRIMARY KEY,
    parameter_name TEXT UNIQUE NOT NULL,
    parameter_value DECIMAL(10,2) NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO trust_score_config (parameter_name, parameter_value, description) VALUES
('base_score_multiplier', 100.0, 'Multiplier to convert 1-5 rating to 0-100 scale'),
('spam_penalty_percent', 30.0, 'Percentage penalty for spam reports'),
('misleading_penalty_percent', 25.0, 'Percentage penalty for misleading reports'),
('scam_penalty_percent', 40.0, 'Percentage penalty for scam reports'),
('minimum_score', 0.0, 'Minimum possible trust score'),
('volume_bonus_threshold', 10.0, 'Number of ratings needed for volume bonus'),
('volume_bonus_points', 5.0, 'Bonus points for high volume URLs'),
('recency_bonus_days', 7.0, 'Days for recency bonus eligibility'),
('recency_bonus_points', 2.0, 'Bonus points for recent activity');

-- Function to get configuration value
CREATE OR REPLACE FUNCTION get_trust_score_config(param_name TEXT)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    config_value DECIMAL(10,2);
BEGIN
    SELECT parameter_value INTO config_value
    FROM trust_score_config
    WHERE parameter_name = param_name;
    
    IF config_value IS NULL THEN
        RAISE EXCEPTION 'Trust score configuration parameter % not found', param_name;
    END IF;
    
    RETURN config_value;
END;
$$;

-- Updated aggregation function using configuration table
CREATE OR REPLACE FUNCTION batch_aggregate_ratings_configurable()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    processed_count INTEGER := 0;
    url_record RECORD;
    total_ratings INTEGER;
    avg_rating DECIMAL(3,2);
    spam_count INTEGER;
    misleading_count INTEGER;
    scam_count INTEGER;
    trust_score DECIMAL(5,2);
BEGIN
    FOR url_record IN 
        SELECT DISTINCT url_hash 
        FROM ratings 
        WHERE processed = false
    LOOP
        -- Get aggregated data
        SELECT 
            COUNT(*),
            AVG(rating),
            COUNT(*) FILTER (WHERE is_spam = true),
            COUNT(*) FILTER (WHERE is_misleading = true),
            COUNT(*) FILTER (WHERE is_scam = true)
        INTO 
            total_ratings, avg_rating, spam_count, misleading_count, scam_count
        FROM ratings 
        WHERE url_hash = url_record.url_hash;

        -- Calculate trust score using configuration
        trust_score := ((avg_rating - 1) / 4) * get_trust_score_config('base_score_multiplier');
        
        IF total_ratings > 0 THEN
            trust_score := trust_score - (spam_count::DECIMAL / total_ratings) * get_trust_score_config('spam_penalty_percent');
            trust_score := trust_score - (misleading_count::DECIMAL / total_ratings) * get_trust_score_config('misleading_penalty_percent');
            trust_score := trust_score - (scam_count::DECIMAL / total_ratings) * get_trust_score_config('scam_penalty_percent');
            trust_score := GREATEST(get_trust_score_config('minimum_score'), trust_score);
        END IF;

        -- Volume bonus
        IF total_ratings >= get_trust_score_config('volume_bonus_threshold') THEN
            trust_score := trust_score + get_trust_score_config('volume_bonus_points');
        END IF;

        -- Recency bonus
        IF EXISTS (
            SELECT 1 FROM ratings 
            WHERE url_hash = url_record.url_hash 
            AND created_at > NOW() - (get_trust_score_config('recency_bonus_days') || ' days')::INTERVAL
        ) THEN
            trust_score := trust_score + get_trust_score_config('recency_bonus_points');
        END IF;

        -- Upsert results (same as before)
        INSERT INTO url_stats (
            url_hash, trust_score, rating_count, average_rating,
            spam_reports_count, misleading_reports_count, scam_reports_count, last_updated
        )
        VALUES (
            url_record.url_hash, ROUND(trust_score, 2), total_ratings, ROUND(avg_rating, 2),
            spam_count, misleading_count, scam_count, NOW()
        )
        ON CONFLICT (url_hash) DO UPDATE SET
            trust_score = EXCLUDED.trust_score,
            rating_count = EXCLUDED.rating_count,
            average_rating = EXCLUDED.average_rating,
            spam_reports_count = EXCLUDED.spam_reports_count,
            misleading_reports_count = EXCLUDED.misleading_reports_count,
            scam_reports_count = EXCLUDED.scam_reports_count,
            last_updated = EXCLUDED.last_updated;

        processed_count := processed_count + 1;
    END LOOP;

    UPDATE ratings SET processed = true WHERE processed = false;
    RETURN 'Processed ' || processed_count || ' URLs with configurable scoring';
END;
$$;