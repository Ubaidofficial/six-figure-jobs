SELECT 
  COUNT(*) as total_jobs,
  COUNT(*) FILTER (WHERE "companyLogo" IS NOT NULL AND "companyLogo" != '') as has_logo,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "companyLogo" IS NOT NULL AND "companyLogo" != '') / NULLIF(COUNT(*),0), 1) as logo_pct
FROM "Job"
WHERE "isExpired" = false;
