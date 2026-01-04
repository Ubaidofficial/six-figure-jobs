SELECT
  "currency",
  COUNT(*) as jobs
FROM "Job"
WHERE "isExpired"=false
  AND "salaryValidated"=true
  AND ("salaryRaw" ILIKE '%₹%' OR "salaryRaw" ILIKE '%INR%')
GROUP BY "currency"
ORDER BY jobs DESC;
