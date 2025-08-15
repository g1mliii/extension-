# Product Overview

## URL Rating Extension

A browser extension that allows users to rate URLs and view aggregated trust statistics. The extension provides a trust scoring system where users can:

- Rate websites on a 1-5 star scale
- Report URLs as spam, misleading, or scam content
- View aggregated trust scores and statistics for any URL
- Access security tool recommendations through affiliate links

The extension uses Supabase for backend authentication and data storage, providing real-time rating aggregation and user management.

## Key Features

- **Enhanced Trust Score System**: Multi-factor algorithm combining domain analysis (40%) and community ratings (60%)
- **Domain Security Analysis**: Automated checking of SSL certificates, domain age, HTTP status, and external threat databases
- **Content-Specific Scoring**: Different trust modifiers for articles, videos, social media, code repositories, etc.
- **External API Integration**: Google Safe Browsing, PhishTank, and WHOIS data for comprehensive domain analysis
- **Reporting System**: Users can flag content as spam, misleading, or scam with weighted penalties
- **Smart Caching**: 7-day cache for expensive API calls to ensure scalability and cost efficiency
- **Blacklist Management**: Pattern-based domain blocking with configurable severity levels
- **User Authentication**: Email/password authentication via Supabase
- **Real-time Statistics**: Live aggregation of ratings and reports with performance monitoring
- **Security Focus**: Includes recommendations for security tools (1Password, NordVPN)