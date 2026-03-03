SELECT 
  "currency",
  COUNT(*) as jobs,
  MIN("minAnnual") as lowest_min,
  MAX("maxAnnual") as highest_max,
  ROUND(AVG("minAnnual"), 0) as avg_min,
  ROUND(AVG("maxAnnual"), 0) as avg_max
FROM "Job"
WHERE "isExpired" = false 
  AND "salaryValidated" = true
  AND "currency" IS NOT NULL
GROUP BY "currency"
ORDER BY jobs DESC;
