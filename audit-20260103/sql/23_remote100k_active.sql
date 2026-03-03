SELECT
  COUNT(*) as active_remote100k
FROM "Job"
WHERE "isExpired" = false
  AND "source" = 'board:remote100k';
