SELECT id, "title", "company", "source", LENGTH(COALESCE("descriptionHtml", '')) as len
FROM "Job"
WHERE "isExpired" = false
  AND "descriptionHtml" IS NOT NULL
  AND LENGTH("descriptionHtml") < 200
ORDER BY len ASC
LIMIT 25;
