SELECT 
  DATE("createdAt") as date,
  COUNT(*) as jobs_added
FROM "Job"
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE("createdAt")
ORDER BY date DESC;
