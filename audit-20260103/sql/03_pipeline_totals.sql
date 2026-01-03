SELECT 
  COUNT(*) as total_jobs,
  COUNT(DISTINCT "companyId") as unique_companies,
  COUNT(DISTINCT "source") as unique_sources,
  MIN("createdAt") as oldest_job,
  MAX("createdAt") as newest_job
FROM "Job"
WHERE "isExpired" = false;
