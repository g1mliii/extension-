-- Trust Score Aggregation System
-- This file contains the core trust score calculation logic
-- Modify the trust score formula in the batch_aggregate_ratings function below

-- Enable the cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create batch aggregation function with configurable trust score logic
CREATE OR REPLACE FUNCTION batch_aggregate_ratings()
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
    
    -- TRUST SCORE CONFIGURATION (modify these values to change scoring)
    base_score_multiplier CONSTANT DECIMAL := 100.0;  -- Convert 1-5 scale to 0-100
    spam_penalty_percent CONSTANT DECIMAL := 30.0;    -- 30% penalty for spam reports
    misleading_penalty_percent CONSTANT DECIMAL := 25.0; -- 25% penalty for misleading reports
    scam_penalty_percent CONSTANT DECIMAL := 40.0;    -- 40% penalty for scam reports
    minimum_score CONSTANT DECIMAL := 0.0;            -- Minimum possible score
    
BEGIN
    -- Get all URLs with unprocessed ratings
    FOR url_record IN 
        SELECT DISTINCT url_hash 
        FROM ratings 
        WHERE processed = false
    LOOP
        -- Get aggregated data for this URL
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

        -- ============================================
        -- ENHANCED TRUST SCORE CALCULATION LOGIC
        -- ============================================
        
        -- Base score: Convert 1-5 rating to 0-100 scale
        trust_score := ((avg_rating - 1) / 4) * base_score_multiplier;
        
        -- Apply penalties based on report percentages
        IF total_ratings > 0 THEN
            -- Progressive penalties (more severe with higher percentages)
            DECLARE
                spam_ratio DECIMAL := spam_count::DECIMAL / total_ratings;
                misleading_ratio DECIMAL := misleading_count::DECIMAL / total_ratings;
                scam_ratio DECIMAL := scam_count::DECIMAL / total_ratings;
            BEGIN
                -- Exponential penalty for high report ratios
                trust_score := trust_score - (spam_ratio * spam_penalty_percent * (1 + spam_ratio));
                trust_score := trust_score - (misleading_ratio * misleading_penalty_percent * (1 + misleading_ratio));
                trust_score := trust_score - (scam_ratio * scam_penalty_percent * (1 + scam_ratio));
            END;
            
            -- Confidence adjustment based on sample size
            DECLARE
                confidence_multiplier DECIMAL := LEAST(1.0, total_ratings::DECIMAL / 10.0);
            BEGIN
                -- Lower confidence for sites with few ratings
                trust_score := trust_score * confidence_multiplier + (100 * (1 - confidence_multiplier) * 0.5);
            END;
            
            -- Ensure score doesn't go below minimum
            trust_score := GREATEST(minimum_score, trust_score);
        END IF;
        
        -- Optional: Add bonus for high volume (uncomment to enable)
        -- IF total_ratings >= 10 THEN
        --     trust_score := trust_score + 5; -- 5 point bonus for 10+ ratings
        -- END IF;
        
        -- Optional: Add recency bonus (uncomment to enable)
        -- IF EXISTS (SELECT 1 FROM ratings WHERE url_hash = url_record.url_hash AND created_at > NOW() - INTERVAL '7 days') THEN
        --     trust_score := trust_score + 2; -- 2 point bonus for recent activity
        -- END IF;
        
        -- ============================================
        -- END TRUST SCORE CALCULATION
        -- ============================================

        -- Upsert into url_stats
        INSERT INTO url_stats (
            url_hash, 
            trust_score, 
            rating_count, 
            average_rating,
            spam_reports_count, 
            misleading_reports_count, 
            scam_reports_count,
            last_updated
        )
        VALUES (
            url_record.url_hash,
            ROUND(trust_score, 2),
            total_ratings,
            ROUND(avg_rating, 2),
            spam_count,
            misleading_count,
            scam_count,
            NOW()
        )
        ON CONFLICT (url_hash) 
        DO UPDATE SET
            trust_score = EXCLUDED.trust_score,
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

    RETURN 'Processed ' || processed_count || ' URLs with unprocessed ratings';
END;
$$;

-- Schedule aggregation every 5 minutes
SELECT cron.schedule(
    'aggregate-ratings-job',
    '*/5 * * * *',
    'SELECT batch_aggregate_ratings();'
);

-- Create a function to manually recalculate all scores (useful after algorithm changes)
CREATE OR REPLACE FUNCTION recalculate_all_trust_scores()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Mark all ratings as unprocessed to force recalculation
    UPDATE ratings SET processed = false;
    
    -- Run the aggregation
    RETURN batch_aggregate_ratings();
END;
$$;

-- Create a view to easily see the trust score distribution
CREATE OR REPLACE VIEW trust_score_analytics AS
SELECT 
    CASE 
        WHEN trust_score >= 80 THEN 'Excellent (80-100)'
        WHEN trust_score >= 60 THEN 'Good (60-79)'
        WHEN trust_score >= 40 THEN 'Fair (40-59)'
        WHEN trust_score >= 20 THEN 'Poor (20-39)'
        ELSE 'Very Poor (0-19)'
    END as score_category,
    COUNT(*) as url_count,
    ROUND(AVG(trust_score), 2) as avg_score_in_category,
    ROUND(AVG(rating_count), 1) as avg_ratings_per_url
FROM url_stats 
WHERE trust_score IS NOT NULL
GROUP BY score_category
ORDER BY avg_score_in_category DESC;

-- Comments for future reference:
COMMENT ON FUNCTION batch_aggregate_ratings() IS 'Main trust score calculation function. Modify the trust score logic section to change scoring algorithm.';
COMMENT ON FUNCTION recalculate_all_trust_scores() IS 'Recalculates all trust scores. Run this after changing the scoring algorithm.';
COMMENT ON VIEW trust_score_analytics IS 'Analytics view showing distribution of trust scores across categories.';