# Trust Scoring System Documentation

## Overview
The URL Rating Extension uses a sophisticated multi-layered trust scoring system that combines domain analysis, community ratings, and content-specific factors to generate trust scores from 0-100.

## Scoring Layers

### 1. Baseline Scoring (Foundation Layer)
Every URL starts with a baseline score based on domain reputation:

**High Trust Domains (70-85 points):**
- `google.com`: 85 points
- `github.com`: 80 points  
- `stackoverflow.com`: 82 points
- `wikipedia.org`: 85 points
- `apple.com`: 80 points
- `microsoft.com`: 78 points

**Educational Domains (75-85 points):**
- `.edu` domains: 75 points
- `mit.edu`, `stanford.edu`, `harvard.edu`: 85 points
- `coursera.org`: 78 points

**News Domains (65-80 points):**
- `bbc.com`: 78 points
- `reuters.com`: 80 points
- `nytimes.com`: 75 points

**Social Media (55-65 points):**
- `facebook.com`: 60 points
- `twitter.com`, `x.com`: 58 points
- `linkedin.com`: 68 points
- `tiktok.com`: 55 points

**Default Scores:**
- `.gov` domains: 75 points
- `.org` domains: 65 points
- `.com/.net` domains: 60 points
- Unknown domains: 50 points

### 2. Domain Analysis (Technical Layer)
When a domain is analyzed and cached, additional factors are applied:

**SSL Certificate:**
- Valid HTTPS: +5 points
- No SSL/HTTP only: -15 points

**Domain Age:**
- 5+ years old: +15 points
- 2-5 years old: +10 points
- 1-2 years old: +5 points
- Less than 30 days: -10 points

**HTTP Status:**
- 4xx/5xx errors: -20 points
- 2xx/3xx responses: No penalty

**Security Checks:**
- Google Safe Browsing malware: -50 points
- Google Safe Browsing phishing: -45 points
- Google Safe Browsing unwanted software: -30 points
- Hybrid Analysis malicious: -40 points
- Hybrid Analysis suspicious: -25 points

### 3. Community Ratings (Social Layer)
User ratings and reports influence the trust score:

**Star Ratings (1-5 scale converted to 0-100):**
- 5 stars = 100 points
- 4 stars = 75 points
- 3 stars = 50 points
- 2 stars = 25 points
- 1 star = 0 points

**Report Penalties:**
- Spam reports: -30 points per report ratio
- Misleading reports: -25 points per report ratio
- Scam reports: -40 points per report ratio

**Confidence Adjustment:**
- Scores are adjusted based on sample size
- Minimum 5 ratings for full confidence
- Fewer ratings blend with baseline (50 points)

### 4. Final Calculation
The final trust score combines all layers:

**Weighted Average:**
- Domain factors: 40% weight
- Community ratings: 60% weight

**Content Type Modifiers:**
- YouTube videos: +5 points
- Wikipedia articles: +10 points
- GitHub repositories: +5 points
- Stack Overflow Q&A: +8 points
- Twitter/X posts: -2 points
- Reddit discussions: No modifier

## Implementation Flow

### When User Loads a Website:
1. **Extract domain** from URL
2. **Check baseline score** from domain reputation database
3. **Query domain cache** for technical analysis data
4. **Query community ratings** for user feedback
5. **Calculate enhanced trust score** using weighted formula
6. **Display result** to user with appropriate color coding

### When User Submits Rating:
1. **Authenticate user** (required for rating submission)
2. **Validate rating data** (1-5 stars, spam/misleading/scam flags)
3. **Store rating** in database with user association
4. **Trigger domain analysis** if domain not cached
5. **Update URL statistics** with new rating data
6. **Recalculate trust scores** using cron job (every 5 minutes)

### Domain Analysis Process:
1. **Check if domain cached** (7-day TTL)
2. **Perform HTTP/SSL check** (5-second timeout)
3. **Determine domain age** (heuristic or WHOIS)
4. **Check security databases** (Google Safe Browsing, etc.)
5. **Calculate threat score** (0-100 scale)
6. **Store in domain cache** with expiration date

## Data Sources

### Internal Data:
- User ratings and reports
- Domain baseline reputation database
- Content type rules and modifiers
- Blacklist patterns and severity levels

### External APIs:
- Google Safe Browsing API (malware/phishing detection)
- Hybrid Analysis API (threat intelligence)
- WHOIS data (domain age verification)
- HTTP/SSL status checks

## Score Interpretation

**90-100: Excellent**
- Highly trusted domains with strong security
- Educational institutions, major tech companies
- High community ratings with no negative reports

**70-89: Good**
- Well-established domains with good reputation
- Some community validation
- Minor security concerns acceptable

**50-69: Fair**
- Average domains with mixed signals
- Limited community data
- Some security or reputation concerns

**30-49: Poor**
- Domains with negative indicators
- Security warnings or poor community feedback
- New domains with suspicious characteristics

**0-29: Very Poor**
- Known malicious or highly suspicious domains
- Multiple security warnings
- Strong negative community consensus

## Caching and Performance

### Domain Cache (7-day TTL):
- Stores expensive API call results
- Reduces external API usage and costs
- Improves response times for repeat requests

### Frontend Cache (5-minute TTL):
- Reduces API calls for same URL
- Improves user experience
- Batch request queuing for efficiency

### Background Processing:
- Cron job aggregates ratings every 5 minutes
- Domain analysis triggered asynchronously
- Statistics updated without blocking user interface

## Security Considerations

### Authentication:
- Rating submission requires user login
- JWT token validation for all authenticated requests
- Service role approach for internal database operations

### Data Validation:
- URL format validation and sanitization
- Rating score bounds checking (1-5 stars)
- SQL injection prevention through parameterized queries

### Rate Limiting:
- Domain analysis respects external API limits
- Batch processing with concurrency controls
- User rating submission cooldowns (24-hour update window)

This multi-layered approach ensures accurate, fair, and comprehensive trust scoring that adapts to both technical security factors and community consensus.