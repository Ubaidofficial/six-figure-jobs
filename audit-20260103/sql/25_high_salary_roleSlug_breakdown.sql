SELECT
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true) as hs_validated,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "roleSlug" IS NOT NULL) as hs_validated_roleSlug,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "roleSlug" IS NULL) as hs_validated_roleSlug_null,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND ("descriptionHtml" IS NULL OR "descriptionHtml" = '')) as hs_validated_missing_description
FROM "Job";
