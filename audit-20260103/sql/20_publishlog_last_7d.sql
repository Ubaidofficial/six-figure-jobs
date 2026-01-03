SELECT 
  "type",
  "createdAt",
  "metadata"
FROM "PublishLog"
WHERE "createdAt" >= NOW() - INTERVAL '7 days'
ORDER BY "createdAt" DESC
LIMIT 20;
