SELECT
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true) as hs_validated,
  COUNT(*) FILTER (
    WHERE "isExpired" = false
      AND "isHighSalary" = true
      AND "salaryValidated" = true
      AND (
        COALESCE("remote", false) = true
        OR "citySlug" IS NOT NULL
        OR "countryCode" IS NOT NULL
      )
  ) as hs_with_any_location_signal
FROM "Job";
