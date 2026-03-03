SELECT 
  "source",
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE "salaryValidated" = true) as validated,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "salaryValidated" = true) / NULLIF(COUNT(*),0), 1) as validated_pct,
  ROUND(AVG(COALESCE("salaryConfidence",0)), 1) as avg_confidence
FROM "Job"
WHERE "isExpired" = false
GROUP BY "source"
ORDER BY total_jobs DESC
LIMIT 20;
