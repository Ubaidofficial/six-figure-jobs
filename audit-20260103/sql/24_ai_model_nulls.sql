SELECT
  COUNT(*) FILTER (WHERE "aiEnrichedAt" IS NOT NULL) as enriched,
  COUNT(*) FILTER (WHERE "aiEnrichedAt" IS NOT NULL AND ("aiModel" IS NULL OR "aiModel" = '')) as enriched_model_missing
FROM "Job"
WHERE "isExpired" = false;
