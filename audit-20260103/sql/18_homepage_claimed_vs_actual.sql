SELECT 
  (SELECT COUNT(*) FROM "Job" WHERE "isExpired" = false) as total_jobs,
  (SELECT COUNT(*) FROM "Job" WHERE "isExpired" = false AND "salaryValidated" = true) as verified_jobs,
  (SELECT COUNT(DISTINCT "companyId") FROM "Job" WHERE "isExpired" = false AND "companyId" IS NOT NULL) as unique_companies;
