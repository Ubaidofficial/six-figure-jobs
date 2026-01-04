SELECT id, "title", LENGTH("title") as len, "source", "company"
FROM "Job"
WHERE "isExpired" = false
  AND (LENGTH("title") < 10 OR LENGTH("title") > 100)
ORDER BY len ASC
LIMIT 25;
