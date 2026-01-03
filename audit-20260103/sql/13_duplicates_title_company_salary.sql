SELECT 
  "title",
  "company",
  "minAnnual",
  "maxAnnual",
  COUNT(*) as duplicate_count,
  STRING_AGG("source", ', ') as sources
FROM "Job"
WHERE "isExpired" = false
GROUP BY "title", "company", "minAnnual", "maxAnnual"
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC
LIMIT 20;
