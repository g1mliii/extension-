// Configuration template for the URL Rating Extension
// Copy this file to config.js and fill in your Supabase credentials

export const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here'
};

// PRODUCTION NOTES:
// - Only these 2 keys are needed for the Chrome extension
// - Both are safe to include in published extensions
// - Backend API keys are stored separately in Supabase environment variables