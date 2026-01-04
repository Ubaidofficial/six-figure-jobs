SELECT
  "id",
  "source",
  "title",
  "company",
  "currency",
  "minAnnual",
  "maxAnnual",
  "salarySource",
  "salaryParseReason",
  COALESCE(LENGTH("salaryRaw"), 0) as salaryraw_len,
  LEFT(REPLACE(COALESCE("salaryRaw", ''), E'\n', ' '), 200) as salaryraw_sample
FROM "Job"
WHERE "isExpired" = false
  AND "salaryValidated" = true
  AND "salaryConfidence" >= 80
  AND "currency" = 'AUD'
  AND "maxAnnual" > 600000
ORDER BY "maxAnnual" DESC
LIMIT 20;
