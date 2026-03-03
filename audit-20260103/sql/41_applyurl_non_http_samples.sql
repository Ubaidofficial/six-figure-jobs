SELECT id, "source", "applyUrl", "url"
FROM "Job"
WHERE "isExpired" = false
  AND "applyUrl" IS NOT NULL
  AND "applyUrl" <> ''
  AND "applyUrl" NOT LIKE 'http%'
LIMIT 25;
