SELECT 
  "id",
  "title",
  "company",
  CONCAT(
    'https://www.6figjobs.com/job/',
    COALESCE("roleSlug", 'unknown'),
    '-at-',
    LOWER(REPLACE("company", ' ', '-'))
  ) as job_url
FROM "Job"
WHERE "isExpired" = false
  AND "roleSlug" IS NOT NULL
  AND "salaryValidated" = true
  AND "isHundredKLocal" = true
ORDER BY "createdAt" DESC
LIMIT 10;
