SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(format('%I.%I', schemaname, tablename))) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(format('%I.%I', schemaname, tablename)) DESC
LIMIT 10;
