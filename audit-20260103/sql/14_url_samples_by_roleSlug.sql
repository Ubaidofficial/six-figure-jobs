SELECT 
  CASE 
    WHEN "roleSlug" IS NOT NULL THEN 'Has roleSlug'
    ELSE 'NULL roleSlug'
  END as slug_status,
  COUNT(*) as count,
  (ARRAY_AGG("url" ORDER BY "createdAt" DESC) FILTER (WHERE "url" IS NOT NULL))[1:3] as sample_urls
FROM "Job"
WHERE "isExpired" = false
GROUP BY slug_status;
