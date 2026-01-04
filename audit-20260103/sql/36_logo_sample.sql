SELECT DISTINCT "company", "companyLogo"
FROM "Job"
WHERE "isExpired" = false
  AND "companyLogo" IS NOT NULL
  AND "companyLogo" != ''
LIMIT 20;
