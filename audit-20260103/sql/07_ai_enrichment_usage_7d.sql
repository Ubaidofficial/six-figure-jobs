SELECT 
  DATE("aiEnrichedAt") as date,
  COUNT(*) as jobs_enriched,
  COUNT(DISTINCT "aiModel") as models_used
FROM "Job"
WHERE "aiEnrichedAt" >= NOW() - INTERVAL '7 days'
GROUP BY DATE("aiEnrichedAt")
ORDER BY date DESC;
