SELECT "title", "company", "currency", "minAnnual", "maxAnnual", "salaryRaw"
FROM "Job"
WHERE "isExpired" = false
  AND "currency" = 'AUD'
  AND "maxAnnual" > 300000
ORDER BY "maxAnnual" DESC
LIMIT 10;
