// Production configuration for Chrome Web Store
// This file contains the actual Supabase credentials for the published extension

export const CONFIG = {
    SUPABASE_URL: 'https://giddaacemfxshmnzhydb.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZGRhYWNlbWZ4c2htbnpoeWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTQ1MDUsImV4cCI6MjA2ODY3MDUwNX0.rSNs9jRLfOuPVYSeHswobvaGidPQfi78RUtD4p9unIY'
};

// SECURITY NOTES:
// ✅ SUPABASE_URL: Safe to expose publicly
// ✅ SUPABASE_ANON_KEY: Safe to expose - designed for client-side use
// ❌ SUPABASE_SERVICE_ROLE_KEY: NEVER include in frontend - server-side only
// ❌ External API keys: NEVER include in frontend - server-side only

// AUTHENTICATION FLOW:
// 1. Frontend uses ANON_KEY for initial requests and auth
// 2. After login, Supabase generates JWT tokens automatically
// 3. Backend functions use SERVICE_ROLE_KEY (stored in Supabase secrets)
// 4. External APIs use their keys (stored in Supabase secrets)