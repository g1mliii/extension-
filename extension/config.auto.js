// Auto-detecting configuration
// This file automatically uses production or development config

let CONFIG;

try {
    // Try to import local config first (development)
    const localConfig = await import('./config.js');
    CONFIG = localConfig.CONFIG;
    console.log('🔧 Using local development config');
} catch (error) {
    // Fall back to production config (Chrome Web Store)
    CONFIG = {
        SUPABASE_URL: 'https://giddaacemfxshmnzhydb.supabase.co',
        SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdpZGRhYWNlbWZ4c2htbnpoeWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMwOTQ1MDUsImV4cCI6MjA2ODY3MDUwNX0.rSNs9jRLfOuPVYSeHswobvaGidPQfi78RUtD4p9unIY'
    };
    console.log('🌐 Using production config (Chrome Web Store)');
}

export { CONFIG };