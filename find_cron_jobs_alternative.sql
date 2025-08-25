-- Try different ways to find cron jobs

-- Method 1: Check all schemas for cron-related tables
SELECT 'All schemas with cron-related tables:' as info;
SELECT DISTINCT table_schema, table_name
FROM information_schema.tables 
WHERE table_name LIKE '%cron%' OR table_name LIKE '%job%' OR table_name LIKE '%schedule%'
ORDER BY table_schema, table_name;

-- Method 2: Check for pg_cron specific tables
SELECT 'Checking pg_cron tables:' as info;
SELECT schemaname, tablename 
FROM pg_tables 
WHERE tablename LIKE '%cron%' OR tablename LIKE '%job%'
ORDER BY schemaname, tablename;

-- Method 3: Try to access cron.job directly with different approaches
SELECT 'Trying direct cron.job access:' as info;
SELECT COUNT(*) as job_count FROM cron.job;

-- Method 4: Check what extensions are installed
SELECT 'Installed extensions:' as info;
SELECT extname, extversion 
FROM pg_extension 
WHERE extname LIKE '%cron%' OR extname LIKE '%job%'
ORDER BY extname;

-- Method 5: Check for any functions that might show cron jobs
SELECT 'Functions that might show cron info:' as info;
SELECT p.proname as function_name, n.nspname as schema_name
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE p.proname LIKE '%cron%' OR p.proname LIKE '%job%' OR p.proname LIKE '%schedule%'
ORDER BY n.nspname, p.proname;