SELECT 
  "currency",
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE "isHundredKLocal" = true) as flagged_100k,
  ROUND(AVG(COALESCE("minAnnual",0)), 0) as avg_min_salary,
  ROUND(AVG(COALESCE("maxAnnual",0)), 0) as avg_max_salary
FROM "Job"
WHERE "isExpired" = false
  AND "currency" IS NOT NULL
GROUP BY "currency"
ORDER BY total_jobs DESC;
