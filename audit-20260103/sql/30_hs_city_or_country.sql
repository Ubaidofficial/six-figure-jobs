SELECT
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true) as hs_validated,
  COUNT(*) FILTER (
    WHERE "isExpired" = false
      AND "isHighSalary" = true
      AND "salaryValidated" = true
      AND ("citySlug" IS NOT NULL OR "countryCode" IS NOT NULL)
  ) as hs_with_city_or_country
FROM "Job";
