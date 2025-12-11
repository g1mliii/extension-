# Cron Job Integration

## Overview

The rating aggregation system uses cron jobs for automatic processing. Both automatic (cron) and manual triggers use the same database function for consistency.

## Configuration

- **Job Name**: `aggregate-ratings-job`
- **Schedule**: Every 5 minutes (`*/5 * * * *`)
- **Command**: `SELECT batch_aggregate_ratings();`

## Processing Flow

1. Cron triggers `batch_aggregate_ratings()` function
2. Function collects unprocessed ratings
3. Calculates enhanced trust scores (domain + community)
4. Updates URL statistics
5. Marks ratings as processed

## Database Function

The `batch_aggregate_ratings()` function handles:
- Enhanced trust score calculation using `calculate_enhanced_trust_score()`
- Processing status tracking
- Error handling with individual URL isolation
- Logging for monitoring

## Edge Function

The `aggregate-ratings` edge function provides manual triggering:

```bash
curl -X POST "https://your-project.supabase.co/functions/v1/aggregate-ratings" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json"
```

## Database Tables

- `ratings` - User ratings with `processed` flag
- `url_stats` - Aggregated statistics
- `domain_cache` - Domain analysis cache
- `cron.job` - PostgreSQL cron configuration

## Processing Status Values

- `community_only` - No domain data available
- `community_with_basic_domain` - Basic domain info present
- `enhanced_with_domain_analysis` - Full external API checks completed

## Verification

```sql
-- Check cron job status
SELECT * FROM cron.job WHERE jobname = 'aggregate-ratings-job';

-- Check unprocessed ratings
SELECT COUNT(*) FROM ratings WHERE processed = false;

-- Test database function manually
SELECT batch_aggregate_ratings();

-- Check recent processing
SELECT * FROM url_stats ORDER BY last_updated DESC LIMIT 10;
```

## Troubleshooting

**Cron Job Not Running**
- Verify job exists in `cron.job` table
- Check PostgreSQL cron extension is enabled
- Review database logs

**Processing Failures**
- Check function logs for errors
- Verify required tables exist
- Ensure `calculate_enhanced_trust_score` function exists

**Edge Function Errors**
- Verify API key is correct (service role)
- Check function deployment status
