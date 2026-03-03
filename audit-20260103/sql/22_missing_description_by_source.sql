SELECT
  "source",
  COUNT(*) as missing_description
FROM "Job"
WHERE "isExpired" = false
  AND ("descriptionHtml" IS NULL OR "descriptionHtml" = '')
GROUP BY "source"
ORDER BY missing_description DESC;
