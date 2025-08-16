-- Fix cron job integration with new API implementation
-- This migration ensures the cron job works correctly with the unified API architecture

-- First, let's verify the current cron job exists and remove it
DO $
BEGIN
    -- Remove existing cron job if it exists
    PERFORM cron.unschedule('aggregate-ratings-job');
    RAISE NOTICE 'Removed existing aggregate-ratings-job cron job';
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'No existing cron job to remove or error occurred: %', SQLERRM;
END;
$;

-- Update the batch_aggregate_ratings function to work with the current database schema
-- This function will be called by the cron job and should match the enhanced processing logic
CREATE OR REPLACE FUNCTION public.batch_aggregate_ratings()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $
DECLARE
    processed_count INTEGER := 0;
    url_record RECORD;
    trust_scores RECORD;
    v_domain TEXT;
    v_domain_cache_exists BOOLEAN;
    v_blacklist_checked BOOLEAN;
    v_external_apis_checked BOOLEAN;
BEGIN
    -- Log start of processing
    RAISE NOTICE 'Starting batch aggregation of ratings at %', NOW();
    
    -- Process all URLs with unprocessed ratings
    FOR url_record IN 
        SELECT DISTINCT url_hash 
        FROM public.ratings 
        WHERE processed = false
    LOOP
        BEGIN
            -- Calculate enhanced trust scores using the enhanced algorithm
            SELECT * INTO trust_scores
            FROM public.calculate_enhanced_trust_score(url_record.url_hash, NULL);
            
            -- Get domain information for processing status
            SELECT domain INTO v_domain 
            FROM public.url_stats 
            WHERE url_hash = url_record.url_hash;
            
            -- If no domain in url_stats, try to get it from ratings table
            IF v_domain IS NULL THEN
                SELECT domain INTO v_domain 
                FROM public.ratings 
                WHERE url_hash = url_record.url_hash 
                LIMIT 1;
            END IF;
            
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
                domain,
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
                v_domain,
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
                domain = COALESCE(EXCLUDED.domain, url_stats.domain),
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
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Log error but continue processing other URLs
                RAISE WARNING 'Error processing URL hash %: %', url_record.url_hash, SQLERRM;
        END;
    END LOOP;

    -- Mark all ratings as processed
    UPDATE public.ratings SET processed = true WHERE processed = false;

    -- Log completion
    RAISE NOTICE 'Completed batch aggregation: processed % URLs at %', processed_count, NOW();

    RETURN 'Enhanced processing completed for ' || processed_count || ' URLs with status tracking';
END;
$;

-- Create the cron job with proper 5-minute schedule
-- This calls the database function directly, which is more efficient than calling the Edge Function
SELECT cron.schedule(
    'aggregate-ratings-job',
    '*/5 * * * *',
    'SELECT batch_aggregate_ratings();'
);

-- Verify the cron job was created
DO $
DECLARE
    job_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO job_count
    FROM cron.job 
    WHERE jobname = 'aggregate-ratings-job';
    
    IF job_count > 0 THEN
        RAISE NOTICE 'SUCCESS: Cron job aggregate-ratings-job created successfully';
        RAISE NOTICE 'Schedule: Every 5 minutes (*/5 * * * *)';
        RAISE NOTICE 'Command: SELECT batch_aggregate_ratings();';
    ELSE
        RAISE EXCEPTION 'FAILED: Cron job was not created';
    END IF;
END;
$;

-- Add comments for documentation
COMMENT ON FUNCTION public.batch_aggregate_ratings() IS 'Enhanced batch processing function called by cron job every 5 minutes. Processes unprocessed ratings and updates URL statistics with enhanced trust scoring.';

-- Grant necessary permissions for the cron job to execute
GRANT EXECUTE ON FUNCTION public.batch_aggregate_ratings() TO postgres;
GRANT EXECUTE ON FUNCTION public.calculate_enhanced_trust_score(TEXT, TEXT) TO postgres;

-- Log migration completion
DO $
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== CRON JOB INTEGRATION MIGRATION COMPLETE ===';
    RAISE NOTICE 'Cron job: aggregate-ratings-job';
    RAISE NOTICE 'Schedule: Every 5 minutes';
    RAISE NOTICE 'Function: batch_aggregate_ratings()';
    RAISE NOTICE 'Integration: Works with unified API architecture';
    RAISE NOTICE 'Processing: Enhanced trust scoring with domain analysis';
    RAISE NOTICE '';
END;
$;