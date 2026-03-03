SELECT 
  "source",
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE "aiEnrichedAt" IS NOT NULL) as enriched,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "aiEnrichedAt" IS NOT NULL) / NULLIF(COUNT(*),0), 1) as enriched_pct
FROM "Job"
WHERE "isExpired" = false
  AND "createdAt" >= NOW() - INTERVAL '30 days'
GROUP BY "source"
ORDER BY total_jobs DESC;
