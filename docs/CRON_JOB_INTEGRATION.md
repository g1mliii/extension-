# Cron Job Integration with Unified API

## Overview

The cron job integration has been updated to work seamlessly with the new unified API architecture. The system now uses a consistent approach for both automatic (cron-triggered) and manual rating aggregation.

## Architecture

### Cron Job Configuration
- **Name**: `aggregate-ratings-job`
- **Schedule**: `*/5 * * * *` (every 5 minutes)
- **Command**: `SELECT batch_aggregate_ratings();`
- **Status**: Active

### Processing Flow

```mermaid
graph TD
    A[Cron Job Trigger] --> B[batch_aggregate_ratings Function]
    C[Manual API Call] --> D[aggregate-ratings Edge Function]
    D --> B
    B --> E[Enhanced Trust Score Calculation]
    E --> F[Update URL Statistics]
    F --> G[Mark Ratings as Processed]
    G --> H[Return Processing Results]
```

## Components

### 1. Database Function: `batch_aggregate_ratings()`

**Location**: Database function (called by cron job)
**Purpose**: Core processing logic for rating aggregation
**Features**:
- Enhanced trust score calculation using domain and community factors
- Processing status tracking (community_only → enhanced_with_domain_analysis)
- Error handling with individual URL processing isolation
- Comprehensive logging for monitoring

**Key Improvements**:
- Uses `calculate_enhanced_trust_score()` for consistent scoring
- Handles domain information extraction and caching
- Updates processing status based on available domain analysis
- Provides detailed error logging without stopping entire batch

### 2. Edge Function: `aggregate-ratings`

**Location**: `supabase/functions/aggregate-ratings/index.ts`
**Purpose**: Manual processing endpoint and API compatibility
**Features**:
- Calls the same database function as cron job for consistency
- API key validation for security
- Detailed request/response logging
- Integration with unified API architecture

**Key Changes**:
- Now calls `batch_aggregate_ratings()` database function directly
- Provides consistent processing logic with cron job
- Enhanced error handling and logging
- Returns processing statistics and verification data

## Database Schema Integration

### Required Tables
- `ratings`: User ratings with `processed` flag
- `url_stats`: Aggregated statistics with enhanced fields
- `domain_cache`: Domain analysis cache with TTL
- `cron.job`: PostgreSQL cron job configuration

### Enhanced Fields
- `final_trust_score`: Primary trust score (0-100)
- `domain_trust_score`: Domain-based component (40% weight)
- `community_trust_score`: Community rating component (60% weight)
- `processing_status`: Tracks processing level
- `domain_analysis_processed`: Boolean flag for domain analysis completion

## Processing Logic

### 1. Rating Collection
- Identifies all unprocessed ratings (`processed = false`)
- Groups by `url_hash` for batch processing
- Handles individual URL processing errors gracefully

### 2. Enhanced Trust Score Calculation
- Calls `calculate_enhanced_trust_score(url_hash, url)`
- Combines domain analysis (40%) and community ratings (60%)
- Applies content-type specific modifiers
- Handles missing domain data gracefully

### 3. Processing Status Determination
```sql
CASE 
    WHEN v_external_apis_checked THEN 'enhanced_with_domain_analysis'
    WHEN v_domain IS NOT NULL THEN 'community_with_basic_domain'
    ELSE 'community_only'
END
```

### 4. Statistics Update
- Upserts `url_stats` with comprehensive data
- Preserves existing domain information
- Updates all relevant counters and scores
- Sets `last_updated` timestamp

### 5. Completion
- Marks all processed ratings as `processed = true`
- Returns processing summary with count
- Logs completion with timestamp

## Monitoring and Verification

### Automatic Monitoring
The cron job runs every 5 minutes and processes:
- New ratings submitted since last run
- Updates URL statistics with enhanced scoring
- Maintains processing status tracking
- Logs all operations for monitoring

### Manual Verification
Use the Edge Function for manual processing:
```bash
curl -X POST "http://localhost:54321/functions/v1/aggregate-ratings" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

### Database Verification
Run the verification script:
```sql
\i supabase/migrations/verify_cron_job_integration.sql
```

## Error Handling

### Cron Job Resilience
- Individual URL processing errors don't stop the entire batch
- Detailed error logging with context
- Continues processing remaining URLs
- Returns summary of successful and failed operations

### Edge Function Error Handling
- API key validation with clear error messages
- Database function call error handling
- Comprehensive error logging with request IDs
- Graceful degradation for partial failures

## Performance Considerations

### Efficiency Optimizations
- Batch processing reduces database calls
- Uses enhanced trust score calculation for consistency
- Leverages domain cache to avoid redundant API calls
- Processes only unprocessed ratings

### Scalability Features
- Handles large batches of ratings efficiently
- Individual error isolation prevents cascade failures
- Comprehensive logging for performance monitoring
- Compatible with unified API architecture

## Integration with Unified API

### Consistency
- Both cron job and manual processing use same database function
- Identical trust score calculation logic
- Same processing status tracking
- Unified error handling approach

### Compatibility
- Works with new `url-trust-api` unified endpoint
- Compatible with enhanced domain analysis
- Supports service role authentication approach
- Maintains backward compatibility with existing data

## Troubleshooting

### Common Issues

1. **Cron Job Not Running**
   - Check `cron.job` table for job existence
   - Verify PostgreSQL cron extension is enabled
   - Check database logs for execution errors

2. **Processing Failures**
   - Check function logs for specific error messages
   - Verify all required tables exist
   - Ensure `calculate_enhanced_trust_score` function is available

3. **Edge Function Errors**
   - Verify API key is correct (service role key)
   - Check function deployment status
   - Review request/response logs

### Verification Commands

```sql
-- Check cron job status
SELECT * FROM cron.job WHERE jobname = 'aggregate-ratings-job';

-- Check unprocessed ratings
SELECT COUNT(*) FROM ratings WHERE processed = false;

-- Test database function
SELECT batch_aggregate_ratings();

-- Check recent processing
SELECT * FROM url_stats ORDER BY last_updated DESC LIMIT 10;
```

## Migration Notes

### Applied Migrations
- `20250816000002_fix_cron_job_integration.sql`: Main integration fix
- `verify_cron_job_integration.sql`: Verification script

### Key Changes
- Updated `batch_aggregate_ratings()` function with enhanced processing
- Recreated cron job with proper configuration
- Added comprehensive error handling and logging
- Integrated with enhanced trust score calculation

### Backward Compatibility
- Maintains existing API contracts
- Preserves existing data structures
- Compatible with current frontend implementation
- Supports both automatic and manual processing

## Requirements Satisfied

This implementation satisfies the following requirements:

- **6.1**: Rating aggregation and domain analysis background processing ✅
- **6.2**: 5-minute cron job processing ✅
- **6.5**: Immediate user feedback without waiting for background processing ✅
- **6.6**: Error logging and retry on next cron cycle ✅

The cron job integration is now fully compatible with the unified API architecture and provides robust, scalable rating aggregation with enhanced trust scoring.