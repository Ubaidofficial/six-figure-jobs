SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE "citySlug" IS NOT NULL) as has_city,
  COUNT(*) FILTER (WHERE "countryCode" IS NOT NULL) as has_country,
  COUNT(*) FILTER (WHERE "citySlug" IS NULL AND "countryCode" IS NULL AND COALESCE("remote", false) = false) as missing_location,
  COUNT(*) FILTER (WHERE COALESCE("remote", false) = true) as remote_jobs
FROM "Job"
WHERE "isExpired" = false;
