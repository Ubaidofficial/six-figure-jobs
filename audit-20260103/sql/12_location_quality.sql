SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE "citySlug" IS NOT NULL) as has_city,
  COUNT(*) FILTER (WHERE "countryCode" IS NOT NULL) as has_country,
  COUNT(*) FILTER (WHERE "stateCode" IS NOT NULL) as has_state,
  COUNT(*) FILTER (WHERE "remote" = true) as remote_jobs,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "citySlug" IS NOT NULL) / NULLIF(COUNT(*),0), 1) as city_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "countryCode" IS NOT NULL) / NULLIF(COUNT(*),0), 1) as country_pct
FROM "Job"
WHERE "isExpired" = false;
