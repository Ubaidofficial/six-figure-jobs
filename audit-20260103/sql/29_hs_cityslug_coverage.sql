SELECT
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true) as hs_validated,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "citySlug" IS NOT NULL) as hs_validated_with_city,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "citySlug" IS NULL) as hs_validated_missing_city,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "countryCode" IS NOT NULL) as hs_validated_with_country,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "countryCode" IS NULL) as hs_validated_missing_country
FROM "Job";
