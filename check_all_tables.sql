-- Check what tables we have and their purposes

-- List all tables
SELECT 'All tables in public schema:' as info;
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check if there's a url_stats table (which might have aggregated data)
SELECT 'url_stats table structure (if exists):' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'url_stats' 
AND table_schema = 'public'
ORDER BY ordinal_position;