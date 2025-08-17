# Rating Cleanup System

## Overview

The Rating Cleanup System automatically deletes processed ratings after 7 days to protect user privacy, optimize database performance, and comply with data minimization principles.

## How It Works

### 1. Rating Lifecycle
```
User submits rating → ratings table (processed = false)
                   ↓
Cron job processes → url_stats updated (processed = true)
                   ↓
After 7 days → Rating deleted automatically
```

### 2. Cleanup Process
- **Frequency**: Daily at 3:00 AM
- **Retention**: 7 days for processed ratings
- **Scope**: Only deletes `processed = true` ratings
- **Preservation**: Aggregated data in `url_stats` is never deleted

## Benefits

### Privacy Protection
- **No permanent tracking**: User rating history automatically deleted
- **GDPR compliance**: Automatic data minimization
- **Anonymization**: Only aggregated statistics remain

### Performance Optimization
- **Small table size**: Ratings table stays lean
- **Fast queries**: Minimal data to scan during operations
- **Efficient processing**: Cron jobs process fewer records

### Fresh Community Opinions
- **Re-rating allowed**: Users can provide updated opinions after cleanup
- **Dynamic scoring**: Trust scores reflect current community sentiment
- **No stale data**: Old ratings don't skew current assessments

## Functions

### `cleanup_processed_ratings(retention_days)`
Deletes processed ratings older than specified days.

```sql
-- Default 7-day cleanup
SELECT cleanup_processed_ratings();

-- Custom retention period
SELECT cleanup_processed_ratings(3);  -- 3 days
SELECT cleanup_processed_ratings(14); -- 2 weeks
```

### `get_rating_cleanup_stats()`
Returns statistics about the ratings table for monitoring.

```sql
SELECT * FROM get_rating_cleanup_stats();
```

**Returns**:
- `total_ratings`: Current number of ratings
- `processed_ratings`: Ratings that have been processed
- `unprocessed_ratings`: Ratings pending processing
- `ratings_older_than_7_days`: Ratings older than 7 days
- `ratings_eligible_for_cleanup`: Processed ratings ready for deletion
- `oldest_rating_age_days`: Age of oldest rating
- `newest_rating_age_hours`: Age of newest rating

## Monitoring

### Daily Monitoring
```sql
-- Check cleanup effectiveness
SELECT * FROM get_rating_cleanup_stats();

-- Check recent cleanup operations
SELECT 
    start_time,
    return_message,
    status
FROM cron.job_run_details 
WHERE jobname = 'cleanup-processed-ratings'
ORDER BY start_time DESC 
LIMIT 5;
```

### Expected Metrics
- **Total ratings**: Should stay relatively stable (new ratings ≈ deleted ratings)
- **Eligible for cleanup**: Should be low if cleanup is working
- **Oldest rating age**: Should not exceed ~7-10 days

## Configuration

### Change Retention Period
```sql
-- Update cron job for different retention
SELECT cron.unschedule('cleanup-processed-ratings');
SELECT cron.schedule(
    'cleanup-processed-ratings',
    '0 3 * * *',  -- Daily at 3 AM
    'SELECT cleanup_processed_ratings(3);'  -- 3 days instead of 7
);
```

### Disable Cleanup
```sql
-- Temporarily disable automatic cleanup
SELECT cron.unschedule('cleanup-processed-ratings');

-- Re-enable later
SELECT cron.schedule(
    'cleanup-processed-ratings',
    '0 3 * * *',
    'SELECT cleanup_processed_ratings(7);'
);
```

### Manual Cleanup
```sql
-- Run cleanup manually
SELECT cleanup_processed_ratings(7);

-- Emergency cleanup (delete all processed ratings)
DELETE FROM ratings WHERE processed = true;
```

## API Impact

### No Breaking Changes
- **Existing functionality preserved**: API continues to work normally
- **Graceful handling**: API handles missing ratings transparently
- **User experience**: No visible changes to rating submission/display

### Improved Behavior
- **Re-rating capability**: Users can rate again after cleanup period
- **Better performance**: Faster API responses due to smaller table
- **Enhanced privacy**: No permanent user tracking

## Troubleshooting

### Cleanup Not Running
```sql
-- Check if cron job exists
SELECT * FROM cron.job WHERE jobname = 'cleanup-processed-ratings';

-- Check recent executions
SELECT * FROM cron.job_run_details 
WHERE jobname = 'cleanup-processed-ratings'
ORDER BY start_time DESC LIMIT 5;
```

### Too Many Ratings Accumulating
```sql
-- Check what's eligible for cleanup
SELECT 
    COUNT(*) as eligible_count,
    MIN(created_at) as oldest_eligible
FROM ratings 
WHERE processed = true 
  AND created_at < NOW() - INTERVAL '7 days';

-- Manual cleanup if needed
SELECT cleanup_processed_ratings(7);
```

### Performance Issues
```sql
-- Check table size
SELECT 
    schemaname,
    tablename,
    attname,
    n_distinct,
    correlation
FROM pg_stats 
WHERE tablename = 'ratings';

-- Check index usage
SELECT * FROM pg_stat_user_indexes WHERE relname = 'ratings';
```

## Security Considerations

### Data Protection
- **Processed ratings only**: Never deletes unprocessed ratings
- **Aggregated data preserved**: url_stats table maintains statistics
- **Audit trail**: Cleanup operations logged in cron job history

### Access Control
- **Function permissions**: Only postgres role can execute cleanup
- **Cron job security**: Runs with appropriate database privileges
- **Monitoring access**: Stats function available to authenticated users

## Best Practices

### Retention Period Selection
- **7 days (default)**: Good balance of privacy and operational buffer
- **3 days**: More aggressive privacy protection
- **14 days**: Conservative approach for high-traffic systems

### Monitoring Schedule
- **Daily**: Check cleanup stats during business hours
- **Weekly**: Review cleanup effectiveness and adjust if needed
- **Monthly**: Analyze trends and optimize retention period

### Backup Considerations
- **Before cleanup**: Ratings are already aggregated in url_stats
- **No special backup needed**: Cleanup is designed to be safe
- **Recovery**: Aggregated data allows system to continue functioning