SELECT 
  "source",
  COUNT(*) as jobs_last_7d,
  COUNT(*) FILTER (WHERE "roleSlug" IS NULL) as null_slugs,
  COUNT(*) FILTER (WHERE "roleSlug" IS NOT NULL) as has_slugs,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "roleSlug" IS NULL) / NULLIF(COUNT(*),0), 1) as null_pct
FROM "Job"
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
  AND "isExpired" = false
GROUP BY "source"
ORDER BY jobs_last_7d DESC;
