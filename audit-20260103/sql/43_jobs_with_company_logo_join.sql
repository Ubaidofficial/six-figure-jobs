SELECT
  COUNT(*) as active_jobs,
  COUNT(*) FILTER (WHERE c."logoUrl" IS NOT NULL AND c."logoUrl" <> '') as active_jobs_with_company_logo,
  ROUND(100.0 * COUNT(*) FILTER (WHERE c."logoUrl" IS NOT NULL AND c."logoUrl" <> '') / NULLIF(COUNT(*),0), 1) as pct
FROM "Job" j
JOIN "Company" c ON c."id" = j."companyId"
WHERE j."isExpired" = false;
