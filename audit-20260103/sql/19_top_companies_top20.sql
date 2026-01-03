SELECT 
  c."name" as company,
  COUNT(j."id") as active_jobs,
  c."logoUrl"
FROM "Company" c
INNER JOIN "Job" j ON j."companyId" = c."id"
WHERE j."isExpired" = false
  AND j."salaryValidated" = true
  AND COALESCE(j."salaryConfidence",0) >= 70
GROUP BY c."id", c."name", c."logoUrl"
ORDER BY active_jobs DESC
LIMIT 20;
