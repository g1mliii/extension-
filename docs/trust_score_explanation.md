# Trust Score Calculation System Explained

## Overview
The trust score system uses a **weighted combination** of domain analysis (40%) and community ratings (60%) to generate a final trust score from 0-100.

## Final Score Formula
```
Final Trust Score = (Domain Score × 0.4) + (Community Score × 0.6)
```

## 1. Community Score (60% weight)

### Base Calculation
- **Rating Scale**: User ratings 1-5 stars converted to 0-100 scale
- **Formula**: `((average_rating - 1) / 4) × 100`
- **Example**: 4.5 stars = `((4.5 - 1) / 4) × 100 = 87.5`

### Report Penalties
- **Spam reports**: -30 points per report ratio
- **Misleading reports**: -25 points per report ratio  
- **Scam reports**: -40 points per report ratio

### Confidence Adjustment
- **Minimum sample**: Requires 5+ ratings for full confidence
- **Formula**: `score × confidence + (50 × (1 - confidence))`
- **Example**: With 2 ratings, confidence = 0.4, so score blends with neutral (50)

## 2. Domain Score (40% weight)

### Base Score: 50 points (neutral)

### Domain Age Bonus (from WHOIS data)
- **5+ years old**: +15 points
- **2-5 years old**: +10 points  
- **1-2 years old**: +5 points
- **Less than 30 days**: -10 points

### SSL Certificate
- **Valid HTTPS**: +5 points
- **No SSL/HTTP only**: -15 points

### HTTP Status
- **4xx/5xx errors**: -20 points
- **2xx/3xx responses**: No penalty

### Security Checks
- **Google Safe Browsing**:
  - Malware: -50 points
  - Phishing: -45 points
  - Unwanted software: -30 points
- **Hybrid Analysis**:
  - Malicious: -40 points
  - Suspicious: -25 points

### Blacklist Penalties
- **Custom blacklist**: Variable penalty based on severity (1-10 scale)

### Content Type Modifiers
- **YouTube videos**: +5 points
- **Wikipedia articles**: +10 points
- **GitHub repositories**: +5 points
- **Stack Overflow**: +8 points
- **Twitter/X posts**: -2 points

## 3. WHOIS Data Usage

### What WHOIS Data is Stored
```json
{
  "domain": "example.com",
  "method": "whois_api",
  "creation_date": "2010-01-15T00:00:00Z",
  "registrar": "GoDaddy",
  "expiry_date": "2025-01-15T00:00:00Z",
  "actual_age_days": 5110,
  "analysis_date": "2024-01-15T10:30:00Z",
  "raw_whois": { /* full WHOIS response */ }
}
```

### How WHOIS Data Affects Score
1. **Domain Age Calculation**: Uses `creation_date` to calculate exact age in days
2. **Trust Bonus**: Older domains get higher trust scores
3. **Registrar Info**: Stored but not currently used in scoring
4. **Expiry Date**: Could be used for future "about to expire" penalties

### Fallback System
- **Primary**: Real WHOIS API data (WhoisXML API)
- **Fallback**: Heuristic domain age estimation
- **Cache**: 7-day TTL to minimize API calls

## 4. Example Calculation

### Scenario: github.com/user/repo
```
Domain Analysis:
- Base score: 50
- Domain age (15+ years): +15
- Valid SSL: +5  
- HTTP 200: +0
- Safe browsing: +0
- GitHub content type: +5
- Domain Score: 75

Community Ratings:
- 10 ratings, average 4.2 stars
- Base: ((4.2-1)/4) × 100 = 80
- 0 spam, 0 misleading, 0 scam reports: +0
- Full confidence (10 ratings): ×1.0
- Community Score: 80

Final Score:
(75 × 0.4) + (80 × 0.6) = 30 + 48 = 78
```

## 5. Data Sources

### Domain Cache Table Fields
- `domain_age_days`: Calculated from WHOIS creation date
- `whois_data`: Full WHOIS response as JSONB
- `http_status`: HTTP response code
- `ssl_valid`: HTTPS availability
- `google_safe_browsing_status`: Security status
- `hybrid_analysis_status`: Threat analysis
- `threat_score`: Combined security score

### External APIs Used
- **WhoisXML API**: Real domain age and registration data
- **Google Safe Browsing**: Malware/phishing detection
- **Hybrid Analysis**: Threat intelligence (optional)

## 6. Caching Strategy
- **Domain analysis**: Cached for 7 days
- **WHOIS data**: Collected daily via batch job (20 domains/day)
- **Community ratings**: Aggregated every 5 minutes
- **API limits**: 600 WHOIS requests/month (within free tier)