-- Check the actual structure of the ratings table to get correct column names

SELECT 'ratings table structure:' as info;
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'ratings' 
AND table_schema = 'public'
ORDER BY ordinal_position;