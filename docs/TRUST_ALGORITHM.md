# Enhanced Trust Score Algorithm

## Overview

The Enhanced Trust Score Algorithm combines multiple data sources to provide comprehensive website trustworthiness scoring. It uses a multi-layered approach that balances automated domain analysis with community feedback.

## Algorithm Components

### 1. Domain Trust Score (40% weight)
Analyzes technical and reputation factors of the domain:

#### Domain Age Analysis
- **5+ years**: +15 points (established domain)
- **2+ years**: +10 points (mature domain)  
- **1+ year**: +5 points (stable domain)
- **<30 days**: -10 points (very new, potentially suspicious)

#### Security Factors
- **Valid SSL Certificate**: +5 points
- **No SSL/Invalid SSL**: -15 points
- **HTTP Error (4xx/5xx)**: -20 points

#### External Reputation Services
- **Google Safe Browsing**:
  - Malware: -50 points
  - Phishing: -45 points
  - Unwanted Software: -30 points
- **PhishTank**:
  - Confirmed Phishing: -40 points
  - Suspicious: -20 points

#### Blacklist Checking
- Custom blacklist with severity levels (1-10)
- Penalty: severity × 5 points (max 50 points)
- Supports domain patterns (*.badsite.com)

### 2. Community Trust Score (60% weight)
Based on user ratings and reports:

#### Base Rating Score
- Converts 1-5 star ratings to 0-100 scale
- Formula: `((average_rating - 1) / 4) × 100`

#### Report Penalties
- **Spam Reports**: 30% penalty per report ratio
- **Misleading Reports**: 25% penalty per report ratio  
- **Scam Reports**: 40% penalty per report ratio

#### Confidence Adjustment
- Full confidence with 5+ ratings
- Lower confidence scores trend toward neutral (50)
- Formula: `score × confidence + (50 × (1 - confidence))`

### 3. Content-Specific Scoring
Different content types receive modifiers:

- **Wikipedia Articles**: +10 points (educational content)
- **Stack Overflow**: +8 points (technical Q&A)
- **GitHub Repositories**: +5 points (open source)
- **YouTube Videos**: +5 points (established platform)
- **LinkedIn Profiles**: +3 points (professional network)
- **Medium Articles**: +2 points (publishing platform)
- **Social Media Posts**: -2 points (requires more scrutiny)

## Scalability Features

### Caching Strategy
- **Domain Cache**: 7-day TTL for expensive API calls
- **Batch Processing**: Analyzes multiple domains concurrently
- **Rate Limiting**: Respects external API limits
- **Background Processing**: Non-blocking domain analysis

### Resource Optimization
- **Concurrent Analysis**: 3 domains analyzed simultaneously
- **Smart Caching**: Only refreshes expired domain data
- **Configurable Limits**: Adjustable batch sizes and timeouts
- **Fallback Handling**: Graceful degradation when APIs fail

## Content-Specific Handling

### Multi-Content Domains
The algorithm handles domains with diverse content types:

#### YouTube (youtube.com)
- **Pattern**: `/watch?v=` → Video content
- **Modifier**: +5 points (trusted platform)
- **Min Ratings**: 2 (videos can be quickly assessed)

#### Wikipedia (wikipedia.org)  
- **Pattern**: `/wiki/` → Article content
- **Modifier**: +10 points (educational, fact-checked)
- **Min Ratings**: 1 (high baseline trust)

#### Reddit (reddit.com)
- **Pattern**: `/r/.*/comments/` → Discussion content
- **Modifier**: 0 points (neutral, community-driven)
- **Min Ratings**: 3 (requires more community input)

#### News Sites (WSJ, etc.)
- **Pattern**: Article URL patterns
- **Modifier**: +2 to +5 points (established journalism)
- **Min Ratings**: 2-3 (professional content)

### URL Pattern Recognition
```sql
-- Example content type rules
INSERT INTO content_type_rules (domain, content_type, url_pattern, trust_score_modifier) VALUES
('youtube.com', 'video', '/watch\?v=', 5),
('wikipedia.org', 'article', '/wiki/', 10),
('reddit.com', 'discussion', '/r/.*/(comments|post)', 0),
('github.com', 'code', '/.*/.*/.*', 5);
```

## API Integration

### External Services
- **Google Safe Browsing API**: Malware/phishing detection
- **PhishTank API**: Phishing database lookup
- **WHOIS Services**: Domain age and registration info
- **SSL Certificate Validation**: Security status checking

### Rate Limiting & Costs
- **Batch Processing**: Reduces API calls
- **Smart Caching**: 7-day cache reduces repeated calls
- **Fallback Logic**: Works without external APIs
- **Cost Optimization**: Only analyzes new/expired domains

## Database Schema

### Core Tables
```sql
-- Domain analysis cache
domain_cache (domain, domain_age_days, ssl_valid, google_safe_browsing_status, ...)

-- Blacklist management  
domain_blacklist (domain_pattern, blacklist_type, severity, source, ...)

-- Content type rules
content_type_rules (domain, content_type, url_pattern, trust_score_modifier, ...)

-- Enhanced URL stats
url_stats (url_hash, domain, content_type, final_trust_score, domain_trust_score, community_trust_score, ...)
```

### Configuration Management
```sql
-- Algorithm parameters
trust_algorithm_config (config_key, config_value, description, ...)
```

## Usage Examples

### Submit Rating with Domain Analysis
```javascript
// Rating submission automatically triggers domain analysis
const response = await fetch('/functions/v1/url-trust-api/rating', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: JSON.stringify({
    url: 'https://example.com/article',
    score: 4,
    isSpam: false
  })
});
```

### Get Enhanced Trust Score
```javascript
// Retrieve comprehensive trust information
const response = await fetch('/functions/v1/url-trust-api/url-stats?url=https://example.com');
const data = await response.json();
// Returns: final_trust_score, domain_trust_score, community_trust_score, content_type
```

### Batch Domain Analysis
```javascript
// Analyze multiple domains for cache refresh
const response = await fetch('/functions/v1/batch-domain-analysis', {
  method: 'POST',
  body: JSON.stringify({ limit: 10 })
});
```

## Configuration

### Algorithm Tuning
```sql
-- Update scoring weights
SELECT update_trust_config('scoring_weights', '{
  "domain_weight": 0.3,
  "community_weight": 0.7
}');

-- Adjust content type modifiers
SELECT update_trust_config('content_type_modifiers', '{
  "article": 3,
  "video": 2,
  "social": -1
}');
```

### Blacklist Management
```sql
-- Add new blacklist entry
INSERT INTO domain_blacklist (domain_pattern, blacklist_type, severity, source) 
VALUES ('*.suspicious-ads.com', 'spam', 7, 'manual');
```

## Monitoring & Analytics

### Performance Metrics
```sql
-- View algorithm performance
SELECT * FROM trust_algorithm_performance 
WHERE date >= NOW() - INTERVAL '7 days';

-- Trust score distribution
SELECT * FROM enhanced_trust_analytics;
```

### Cache Status
```sql
-- Check cache hit rates
SELECT 
  COUNT(*) as total_domains,
  COUNT(*) FILTER (WHERE cache_expires_at > NOW()) as cached_domains,
  ROUND(COUNT(*) FILTER (WHERE cache_expires_at > NOW()) * 100.0 / COUNT(*), 2) as cache_hit_rate
FROM domain_cache;
```

## Deployment

### Environment Variables
```bash
# Required for external API integration
GOOGLE_SAFE_BROWSING_API_KEY=your_api_key
PHISHTANK_API_KEY=your_api_key

# Supabase configuration
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### Migration Deployment
```bash
# Deploy new migrations
supabase db push

# Deploy edge functions
supabase functions deploy trust-admin
supabase functions deploy trust-score-api
supabase functions deploy batch-domain-analysis
supabase functions deploy url-trust-api
supabase functions deploy aggregate-ratings
```

### Cron Jobs
The system automatically runs:
- **Rating Aggregation**: Every 5 minutes
- **Domain Cache Refresh**: On-demand via batch analysis
- **Performance Monitoring**: Real-time via views

## Future Enhancements

### Planned Features
1. **Machine Learning Integration**: Pattern recognition for new threats
2. **Reputation Networks**: Integration with additional security services
3. **User Behavior Analysis**: Detect coordinated fake ratings
4. **Real-time Updates**: WebSocket notifications for score changes
5. **API Rate Optimization**: Intelligent batching and prioritization

### Scalability Improvements
1. **Distributed Caching**: Redis integration for high-traffic scenarios
2. **Queue System**: Background job processing for domain analysis
3. **CDN Integration**: Edge caching for frequently accessed scores
4. **Database Sharding**: Horizontal scaling for large datasets

This enhanced trust algorithm provides a robust, scalable foundation for website trustworthiness assessment while maintaining performance and cost efficiency.