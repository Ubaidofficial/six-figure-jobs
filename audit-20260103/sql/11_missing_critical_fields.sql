SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE "title" IS NULL OR "title" = '') as missing_title,
  COUNT(*) FILTER (WHERE "company" IS NULL OR "company" = '') as missing_company,
  COUNT(*) FILTER (WHERE "url" IS NULL OR "url" = '') as missing_url,
  COUNT(*) FILTER (WHERE "applyUrl" IS NULL OR "applyUrl" = '') as missing_apply_url,
  COUNT(*) FILTER (WHERE "descriptionHtml" IS NULL OR "descriptionHtml" = '') as missing_description
FROM "Job"
WHERE "isExpired" = false;
