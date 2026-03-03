SELECT
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true) as hs_validated,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "companyId" IS NOT NULL) as hs_validated_with_company,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "companyId" IS NULL) as hs_validated_missing_company,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "primaryLocation" IS NOT NULL) as hs_validated_with_primary_location,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "primaryLocation" IS NULL) as hs_validated_missing_primary_location,
  COUNT(*) FILTER (WHERE "isExpired" = false AND "isHighSalary" = true AND "salaryValidated" = true AND "applyUrl" IS NOT NULL AND "applyUrl" <> '') as hs_validated_with_apply
FROM "Job";
