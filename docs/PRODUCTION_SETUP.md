# Production Setup Guide

## Frontend (Chrome Extension)

### Required Configuration
Only 2 keys needed in `extension/config.js`:

```javascript
export const CONFIG = {
    SUPABASE_URL: 'https://giddaacemfxshmnzhydb.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZGRhYWNlbWZ4c2htbnpoeWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTQ1MDUsImV4cCI6MjA2ODY3MDUwNX0.rSNs9jRLfOuPVYSeHswobvaGidPQfi78RUtD4p9unIY'
};
```

### Chrome Web Store Deployment
1. Copy `extension/config.production.js` to `extension/config.js`
2. Zip the `extension/` folder
3. Upload to Chrome Web Store

## Backend (Supabase Functions)

### Required Environment Variables
Set these in your Supabase project dashboard under Settings > Edge Functions:

#### Essential (Required)
```bash
SUPABASE_URL=https://giddaacemfxshmnzhydb.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... # NEVER expose this
```

#### Optional (Enhanced Features)
```bash
GOOGLE_SAFE_BROWSING_API_KEY=your_google_api_key  # Optional - improves threat detection
HYBRID_ANALYSIS_API_KEY=your_hybrid_api_key       # Optional - improves threat detection
```

### How to Set Environment Variables in Supabase

1. Go to your Supabase project dashboard
2. Navigate to Settings > Edge Functions
3. Add each environment variable
4. Redeploy your functions: `supabase functions deploy`

## Authentication Flow (How it Works)

### 1. Unauthenticated Requests
- Frontend uses `SUPABASE_ANON_KEY`
- Can view public data (URL stats, ratings)
- Limited by RLS policies

### 2. User Authentication
- User logs in via frontend
- Supabase generates JWT tokens automatically
- Frontend includes JWT in subsequent requests
- Backend validates JWT using `SUPABASE_SERVICE_ROLE_KEY`

### 3. Backend Operations
- Functions use `SUPABASE_SERVICE_ROLE_KEY` for database operations
- External APIs use their respective keys (if available)
- Fallback logic when external APIs are unavailable

## Security Best Practices

### ✅ Safe to Expose (Frontend)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### ❌ Never Expose (Backend Only)
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_SAFE_BROWSING_API_KEY`
- `HYBRID_ANALYSIS_API_KEY`

### 🔒 How Security is Maintained
- RLS policies control data access
- Service role key has full access but is server-side only
- JWT tokens are validated server-side
- External API keys are optional and have fallbacks

## Testing Production Setup

### Test Frontend
```bash
# Load extension in Chrome and test:
# 1. View URL stats (should work without login)
# 2. Login/signup (should work)
# 3. Submit ratings (should work after login)
```

### Test Backend
```bash
# Test API endpoints
curl -X GET "https://giddaacemfxshmnzhydb.supabase.co/functions/v1/url-trust-api/url-stats?url=https://example.com"

# Test authenticated endpoint (need user JWT)
curl -X POST "https://giddaacemfxshmnzhydb.supabase.co/functions/v1/url-trust-api/rating" \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "score": 4}'
```

## Minimal Production Setup

**For basic functionality, you only need:**
1. Frontend: `SUPABASE_URL` + `SUPABASE_ANON_KEY`
2. Backend: `SUPABASE_SERVICE_ROLE_KEY`

**External API keys are optional** - the system works without them but with reduced threat detection capabilities.