SELECT
  "id",
  "source",
  "title",
  "company",
  "countryCode",
  "currency",
  "salaryCurrency",
  "salaryPeriod",
  "salaryMin",
  "salaryMax",
  LEFT(REPLACE(COALESCE("salaryRaw", ''), E'\n', ' '), 200) as salaryraw_head
FROM "Job"
WHERE "isExpired"=false
  AND "salaryValidated"=true
  AND "currency"='USD'
  AND ("salaryRaw" ILIKE '%₹%' OR "salaryRaw" ILIKE '%INR%')
LIMIT 10;
