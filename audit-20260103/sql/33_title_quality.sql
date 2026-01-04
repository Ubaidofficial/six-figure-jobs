SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE LENGTH("title") < 10) as too_short,
  COUNT(*) FILTER (WHERE LENGTH("title") > 100) as too_long,
  COUNT(*) FILTER (WHERE "title" LIKE '%...%') as truncated
FROM "Job"
WHERE "isExpired" = false;
