-- Find the exact function causing the array_agg error
-- This will identify which function has the problematic syntax

-- First, let's see all functions that contain array_agg
SELECT 
    p.proname as function_name,
    p.oid,
    CASE 
        WHEN pg_get_functiondef(p.oid) LIKE '%array_agg(DISTINCT%ORDER BY%' THEN 'PROBLEMATIC - has DISTINCT with ORDER BY'
        WHEN pg_get_functiondef(p.oid) LIKE '%array_agg%' THEN 'Contains array_agg'
        ELSE 'No array_agg'
    END as status,
    LENGTH(pg_get_functiondef(p.oid)) as def_length
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND pg_get_functiondef(p.oid) LIKE '%array_agg%'
ORDER BY p.proname;

-- Now let's see the actual problematic function definition
-- We'll look for the specific error pattern
SELECT 
    p.proname as function_name,
    SUBSTRING(pg_get_functiondef(p.oid), 1, 500) as function_start
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND pg_get_functiondef(p.oid) LIKE '%array_agg%'
AND pg_get_functiondef(p.oid) LIKE '%DISTINCT%';