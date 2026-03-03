SELECT 
  COUNT(*) as total_active,
  COUNT(*) FILTER (WHERE "techStack" IS NOT NULL AND LENGTH(COALESCE("techStack",'')) > 0) as has_tech_stack,
  COUNT(*) FILTER (WHERE "aiEnrichedAt" IS NOT NULL) as ai_enriched,
  COUNT(*) FILTER (WHERE "aiSnippet" IS NOT NULL AND LENGTH(COALESCE("aiSnippet",'')) > 0) as has_snippet,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "techStack" IS NOT NULL AND LENGTH(COALESCE("techStack",'')) > 0) / NULLIF(COUNT(*),0), 1) as tech_stack_pct,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "aiEnrichedAt" IS NOT NULL) / NULLIF(COUNT(*),0), 1) as enriched_pct
FROM "Job"
WHERE "isExpired" = false;
