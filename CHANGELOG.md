# Changelog

## [2025-01-17] - Rating Cleanup System & Cron Job Optimization

### Added
- **Rating Cleanup System**: Automatic deletion of processed ratings after 7 days
  - `cleanup_processed_ratings()` function for privacy protection
  - `get_rating_cleanup_stats()` function for monitoring
  - Daily cron job at 3:00 AM for automatic cleanup
  - GDPR compliance through data minimization

### Changed
- **Cron Job Optimization**: Removed duplicate rating processing
  - Removed redundant `enhanced-processing-job` that was duplicating work
  - Kept optimized `aggregate-ratings-job` for rating processing
  - Maintained `cleanup-old-urls` for URL stats maintenance

### Benefits
- **Privacy**: User rating history automatically deleted after 7 days
- **Performance**: Smaller ratings table, faster queries
- **Efficiency**: Eliminated duplicate cron job processing
- **Fresh Opinions**: Users can re-rate URLs after cleanup period
- **Database Optimization**: Automatic cleanup of old data

### Technical Details
- **Retention Period**: 7 days for processed ratings
- **Cleanup Schedule**: Daily at 3:00 AM
- **Monitoring**: Use `SELECT * FROM get_rating_cleanup_stats();`
- **Manual Cleanup**: `SELECT cleanup_processed_ratings(7);`

### Migration Files
- `20250817000000_add_rating_cleanup.sql` - Rating cleanup system
- `20250817000001_cleanup_duplicate_cron_jobs.sql` - Cron job optimization
- `verify_rating_cleanup.sql` - Verification script

### API Impact
- **No Breaking Changes**: Existing API functionality preserved
- **Improved UX**: Users can re-rate after cleanup period
- **Better Performance**: Faster rating queries due to smaller table size

### Cron Jobs (Final Configuration)
1. **aggregate-ratings-job**: Every 5 minutes - Process ratings and calculate trust scores
2. **cleanup-processed-ratings**: Daily at 3:00 AM - Delete old processed ratings
3. **cleanup-old-urls**: Daily at 2:00 AM - Clean up unused URL statistics