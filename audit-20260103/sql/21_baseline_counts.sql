SELECT
  COUNT(*) FILTER (WHERE "isExpired" = false) as active_jobs,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "roleSlug" IS NULL) as active_null_roleSlug,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "isExpired" = false AND "roleSlug" IS NULL) / NULLIF(COUNT(*) FILTER (WHERE "isExpired" = false),0), 1) as null_roleSlug_pct,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "salaryValidated" = true) as active_salary_validated,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true) as active_high_salary,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true) as active_high_salary_validated,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "aiEnrichedAt" IS NOT NULL) as active_ai_enriched,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "techStack" IS NOT NULL AND LENGTH(COALESCE("techStack",'')) > 0) as active_has_tech_stack
FROM "Job";
