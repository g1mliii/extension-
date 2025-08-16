# Technology Stack

## Frontend
- **Browser Extension**: Chrome Extension Manifest V3
- **Languages**: HTML5, CSS3, JavaScript (ES6+ modules)
- **Styling**: Custom CSS with CSS variables, glassmorphism design patterns
- **Architecture**: Modular JavaScript with separate auth and UI modules

## Backend
- **Database & Auth**: Supabase (PostgreSQL + Auth)
- **Edge Functions**: Deno runtime with TypeScript
- **API**: RESTful endpoints via Supabase functions

## Key Libraries & Dependencies
- **Supabase Client**: Authentication and database operations
- **Browser APIs**: Chrome Extension APIs (activeTab, storage, scripting)

## Development Patterns
- **Module System**: ES6 imports/exports
- **Authentication Flow**: PKCE flow for secure auth
- **State Management**: Browser extension storage API
- **Error Handling**: Custom error classes with proper error propagation
- **Processing Status**: Multi-level URL processing (community_only → enhanced_with_domain_analysis)
- **Security**: RLS policies with service role for database operations
- **State Management**: Browser extension storage API
- **Error Handling**: Custom error classes with proper error propagation

## Common Commands

### Supabase Development
```bash
# Start local Supabase
supabase start

# Deploy all functions
supabase functions deploy

# Deploy specific functions (current active functions)
supabase functions deploy url-trust-api
supabase functions deploy trust-admin
supabase functions deploy trust-score-api
supabase functions deploy batch-domain-analysis
supabase functions deploy aggregate-ratings

# Generate types
supabase gen types typescript --local > types/supabase.ts

# Run migrations (includes enhanced trust algorithm)
supabase db push

# Test unified API
curl -X GET "http://localhost:54321/functions/v1/url-trust-api/url-stats?url=https://example.com" \
  -H "Authorization: Bearer YOUR_ANON_KEY"

# Test rating submission
curl -X POST "http://localhost:54321/functions/v1/url-trust-api/rating" \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "score": 4, "isSpam": false}'

# Test domain analysis
curl -X POST "http://localhost:54321/functions/v1/batch-domain-analysis" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 1}'

# Batch analyze domains
curl -X POST "http://localhost:54321/functions/v1/batch-domain-analysis" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"limit": 5}'
```

### Extension Development
```bash
# Load extension in Chrome
# 1. Open chrome://extensions/
# 2. Enable Developer mode
# 3. Click "Load unpacked" and select extension-/rating-extension/

# No build process required - direct file loading
```

## Architecture Notes
- Uses Manifest V3 service workers (not background scripts)
- Implements proper CSP (Content Security Policy) compliance
- Modular CSS with CSS custom properties for theming
- Glassmorphism UI design with backdrop filters
- Multi-factor trust scoring algorithm with external API integration
- Scalable caching system with 7-day TTL for domain analysis
- Content-specific scoring for different URL types (articles, videos, social media)
- Background processing for domain analysis to maintain UI responsiveness
- **Unified API**: `url-trust-api` function serves as main entry point for all operations
- **Service Role Authentication**: Uses service role approach with JWT validation for security
- **Smart Caching**: Frontend implements 5-minute localStorage caching with batch request queuing
- **Error Handling**: Comprehensive error logging with standardized response formats

## Current Issues Being Addressed
- **Domain Cache 406 Error**: Investigating 406 "Not Acceptable" responses when checking domain_cache table
- **Security Warnings**: Fixing "Function Search Path Mutable" warnings for 19 database functions
- **UI Issues**: Trust score percentage bar display accuracy and rating submission feedback
- **Auth Settings**: Reducing OTP expiry and enabling leaked password protection