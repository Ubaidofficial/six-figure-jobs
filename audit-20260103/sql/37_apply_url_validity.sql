SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE "applyUrl" IS NULL OR "applyUrl" = '') as missing_apply,
  COUNT(*) FILTER (WHERE "applyUrl" LIKE 'http%') as valid_url,
  COUNT(*) FILTER (WHERE "url" IS NULL OR "url" = '') as missing_url
FROM "Job"
WHERE "isExpired" = false;
