# Production Setup Guide

## Frontend (Chrome Extension)

### Required Configuration

Only 2 keys needed in `extension/config.js`:

```javascript
export const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key'
};
```

### Chrome Web Store Deployment

1. Copy `extension/config.production.js` to `extension/config.js`
2. Zip the `extension/` folder
3. Upload to Chrome Web Store

## Backend (Supabase Functions)

### Required Environment Variables

Set these in your Supabase project dashboard under Settings > Edge Functions:

**Essential (Required)**
```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Keep secret
```

**Optional (Enhanced Features)**
```bash
GOOGLE_SAFE_BROWSING_API_KEY=your_google_api_key
HYBRID_ANALYSIS_API_KEY=your_hybrid_api_key
```

### Setting Environment Variables

1. Go to your Supabase project dashboard
2. Navigate to Settings > Edge Functions
3. Add each environment variable
4. Redeploy functions: `supabase functions deploy`

## Authentication Flow

### Unauthenticated Requests
- Frontend uses `SUPABASE_ANON_KEY`
- Can view public data (URL stats, ratings)
- Limited by RLS policies

### User Authentication
- User logs in via frontend
- Supabase generates JWT tokens
- Frontend includes JWT in requests
- Backend validates JWT using service role key

### Backend Operations
- Functions use service role key for database operations
- External APIs use their respective keys when available
- Fallback logic when external APIs are unavailable

## Security

### Safe to Expose (Frontend)
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Keep Secret (Backend Only)
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_SAFE_BROWSING_API_KEY`
- `HYBRID_ANALYSIS_API_KEY`

### How Security Works
- RLS policies control data access
- Service role key is server-side only
- JWT tokens validated server-side
- External API keys are optional with fallbacks

## Testing

### Test Frontend
```bash
# Load extension in Chrome and test:
# 1. View URL stats (works without login)
# 2. Login/signup
# 3. Submit ratings (requires login)
```

### Test Backend
```bash
# Test API endpoints
curl -X GET "https://your-project.supabase.co/functions/v1/url-trust-api/url-stats?url=https://example.com"

# Test authenticated endpoint
curl -X POST "https://your-project.supabase.co/functions/v1/url-trust-api/rating" \
  -H "Authorization: Bearer YOUR_USER_JWT" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com", "score": 4}'
```

## Minimal Setup

For basic functionality you need:
1. Frontend: `SUPABASE_URL` + `SUPABASE_ANON_KEY`
2. Backend: `SUPABASE_SERVICE_ROLE_KEY`

External API keys are optional - the system works without them but with reduced threat detection.
