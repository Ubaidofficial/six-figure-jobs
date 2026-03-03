SELECT "locationRaw", "citySlug", "countryCode", COUNT(*) as count
FROM "Job"
WHERE "isExpired" = false
  AND "locationRaw" IS NOT NULL
  AND "citySlug" IS NULL
  AND "countryCode" IS NULL
GROUP BY "locationRaw", "citySlug", "countryCode"
ORDER BY count DESC
LIMIT 20;
