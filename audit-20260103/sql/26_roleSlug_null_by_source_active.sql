SELECT
  "source",
  COUNT(*) as active_jobs,
  COUNT(*) FILTER (WHERE "roleSlug" IS NULL) as null_slugs,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "roleSlug" IS NULL) / NULLIF(COUNT(*),0), 1) as null_pct
FROM "Job"
WHERE "isExpired" = false
GROUP BY "source"
ORDER BY active_jobs DESC;
