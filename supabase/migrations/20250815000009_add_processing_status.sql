-- Simple Processing Status Tracking
-- Just add basic columns to track processing status

-- Add columns to track processing status
ALTER TABLE url_stats ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'community_only';
ALTER TABLE url_stats ADD COLUMN IF NOT EXISTS domain_analysis_processed BOOLEAN DEFAULT FALSE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_url_stats_processing_status ON url_stats(processing_status);

-- Simple view to see processing status
CREATE OR REPLACE VIEW url_processing_status AS
SELECT 
    url_hash,
    domain,
    processing_status,
    CASE processing_status
        WHEN 'community_only' THEN '🟡 Basic'
        WHEN 'enhanced_with_domain_analysis' THEN '🟢 Full'
        ELSE '🟠 Partial'
    END as status_description,
    domain_analysis_processed,
    final_trust_score,
    rating_count,
    last_updated
FROM url_stats
ORDER BY processing_status, last_updated DESC;

-- Simple function to get processing status summary
CREATE OR REPLACE FUNCTION get_processing_status_summary()
RETURNS TABLE(
    processing_status TEXT,
    url_count BIGINT,
    percentage DECIMAL
)
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $
BEGIN
    RETURN QUERY
    WITH status_counts AS (
        SELECT 
            u.processing_status,
            COUNT(*) as url_count
        FROM public.url_stats u
        GROUP BY u.processing_status
    ),
    total_count AS (
        SELECT SUM(url_count) as total FROM status_counts
    )
    SELECT 
        sc.processing_status,
        sc.url_count,
        ROUND(sc.url_count * 100.0 / tc.total, 2) as percentage
    FROM status_counts sc
    CROSS JOIN total_count tc
    ORDER BY sc.url_count DESC;
END;
$;