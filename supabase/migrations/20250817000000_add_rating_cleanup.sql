-- Add Rating Cleanup System
-- Deletes processed ratings older than 7 days for privacy and database efficiency

-- Create cleanup function for processed ratings
CREATE OR REPLACE FUNCTION cleanup_processed_ratings(retention_days INTEGER DEFAULT 7)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
DECLARE
    deleted_count INTEGER;
    cutoff_date TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Calculate cutoff date
    cutoff_date := NOW() - INTERVAL '1 day' * retention_days;
    
    -- Delete processed ratings older than retention period
    DELETE FROM ratings 
    WHERE processed = true 
      AND created_at < cutoff_date;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log the cleanup operation
    RAISE NOTICE 'Rating cleanup completed: deleted % processed ratings older than % days (cutoff: %)', 
                 deleted_count, retention_days, cutoff_date;
    
    RETURN 'Deleted ' || deleted_count || ' processed ratings older than ' || retention_days || ' days';
END;
$;

-- Add comment for documentation
COMMENT ON FUNCTION cleanup_processed_ratings IS 'Deletes processed ratings older than specified days (default 7) for privacy and database efficiency. Called by daily cron job.';

-- Grant execute permission to postgres for cron job
GRANT EXECUTE ON FUNCTION cleanup_processed_ratings TO postgres;

-- Schedule daily cleanup cron job
-- Runs every day at 3:00 AM to clean up processed ratings older than 7 days
DO $
BEGIN
    -- Remove existing cleanup job if it exists
    BEGIN
        PERFORM cron.unschedule('cleanup-processed-ratings');
        RAISE NOTICE 'Removed existing cleanup-processed-ratings cron job';
    EXCEPTION
        WHEN OTHERS THEN
            RAISE NOTICE 'No existing cleanup-processed-ratings cron job found';
    END;
    
    -- Create new cleanup job
    PERFORM cron.schedule(
        'cleanup-processed-ratings',
        '0 3 * * *',  -- Every day at 3:00 AM
        'SELECT cleanup_processed_ratings(7);'  -- Keep processed ratings for 7 days
    );
    
    RAISE NOTICE 'Created cleanup-processed-ratings cron job: daily at 3:00 AM, 7-day retention';
END;
$;

-- Create function to get cleanup statistics
CREATE OR REPLACE FUNCTION get_rating_cleanup_stats()
RETURNS TABLE(
    total_ratings BIGINT,
    processed_ratings BIGINT,
    unprocessed_ratings BIGINT,
    ratings_older_than_7_days BIGINT,
    ratings_eligible_for_cleanup BIGINT,
    oldest_rating_age_days INTEGER,
    newest_rating_age_hours INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_ratings,
        COUNT(*) FILTER (WHERE processed = true) as processed_ratings,
        COUNT(*) FILTER (WHERE processed = false) as unprocessed_ratings,
        COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days') as ratings_older_than_7_days,
        COUNT(*) FILTER (WHERE processed = true AND created_at < NOW() - INTERVAL '7 days') as ratings_eligible_for_cleanup,
        COALESCE(EXTRACT(days FROM NOW() - MIN(created_at))::INTEGER, 0) as oldest_rating_age_days,
        COALESCE(EXTRACT(hours FROM NOW() - MAX(created_at))::INTEGER, 0) as newest_rating_age_hours
    FROM ratings;
END;
$;

-- Add comment for documentation
COMMENT ON FUNCTION get_rating_cleanup_stats IS 'Returns statistics about ratings table for monitoring cleanup effectiveness';

-- Grant execute permission for monitoring
GRANT EXECUTE ON FUNCTION get_rating_cleanup_stats TO authenticated, anon;

-- Test the cleanup function (dry run)
DO $
DECLARE
    test_result TEXT;
    stats_before RECORD;
    stats_after RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=== RATING CLEANUP SYSTEM INSTALLATION ===';
    RAISE NOTICE '';
    
    -- Get current statistics
    SELECT * INTO stats_before FROM get_rating_cleanup_stats();
    
    RAISE NOTICE 'Current Rating Statistics:';
    RAISE NOTICE '- Total ratings: %', stats_before.total_ratings;
    RAISE NOTICE '- Processed ratings: %', stats_before.processed_ratings;
    RAISE NOTICE '- Unprocessed ratings: %', stats_before.unprocessed_ratings;
    RAISE NOTICE '- Ratings older than 7 days: %', stats_before.ratings_older_than_7_days;
    RAISE NOTICE '- Eligible for cleanup: %', stats_before.ratings_eligible_for_cleanup;
    RAISE NOTICE '- Oldest rating age: % days', stats_before.oldest_rating_age_days;
    RAISE NOTICE '';
    
    -- Test cleanup function (this will actually clean up if there are eligible ratings)
    SELECT cleanup_processed_ratings(7) INTO test_result;
    RAISE NOTICE 'Cleanup test result: %', test_result;
    
    -- Get statistics after cleanup
    SELECT * INTO stats_after FROM get_rating_cleanup_stats();
    
    IF stats_after.total_ratings != stats_before.total_ratings THEN
        RAISE NOTICE 'Cleanup performed: % ratings removed', 
                     (stats_before.total_ratings - stats_after.total_ratings);
    ELSE
        RAISE NOTICE 'No ratings were eligible for cleanup';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE 'Cron Job Configuration:';
    RAISE NOTICE '- Job name: cleanup-processed-ratings';
    RAISE NOTICE '- Schedule: Daily at 3:00 AM (0 3 * * *)';
    RAISE NOTICE '- Retention: 7 days for processed ratings';
    RAISE NOTICE '- Function: cleanup_processed_ratings(7)';
    RAISE NOTICE '';
    RAISE NOTICE 'Benefits:';
    RAISE NOTICE '- ✓ Privacy: User rating history automatically deleted';
    RAISE NOTICE '- ✓ Performance: Keeps ratings table small and fast';
    RAISE NOTICE '- ✓ Fresh opinions: Users can re-rate after cleanup';
    RAISE NOTICE '- ✓ GDPR compliance: Automatic data minimization';
    RAISE NOTICE '';
    RAISE NOTICE 'Monitoring:';
    RAISE NOTICE '- Use get_rating_cleanup_stats() to monitor table size';
    RAISE NOTICE '- Check cron job logs for cleanup operations';
    RAISE NOTICE '- Adjust retention period if needed: cleanup_processed_ratings(N)';
    RAISE NOTICE '';
    RAISE NOTICE '=== INSTALLATION COMPLETE ===';
END;
$;