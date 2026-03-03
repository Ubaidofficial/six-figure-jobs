SELECT 
  "source",
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE "descriptionHtml" IS NULL OR "descriptionHtml" = '') as missing_desc,
  COUNT(*) FILTER (WHERE "descriptionHtml" IS NOT NULL AND LENGTH("descriptionHtml") < 200) as short_desc
FROM "Job"
WHERE "isExpired" = false
GROUP BY "source"
ORDER BY missing_desc DESC;
