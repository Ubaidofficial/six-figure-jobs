SELECT 
  c."name" as company,
  c."atsProvider",
  COUNT(j."id") as active_jobs,
  COUNT(*) FILTER (WHERE j."roleSlug" IS NULL) as null_slugs
FROM "Company" c
LEFT JOIN "Job" j ON j."companyId" = c."id" AND j."isExpired" = false
WHERE c."atsProvider" IS NOT NULL
GROUP BY c."id", c."name", c."atsProvider"
ORDER BY active_jobs DESC
LIMIT 30;
