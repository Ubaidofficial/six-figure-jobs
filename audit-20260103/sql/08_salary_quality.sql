SELECT 
  COUNT(*) as total_active,
  COUNT(*) FILTER (WHERE "salaryRaw" IS NOT NULL AND LENGTH(COALESCE("salaryRaw",''))>0) as has_salary_raw,
  COUNT(*) FILTER (WHERE "minAnnual" IS NOT NULL) as has_min_annual,
  COUNT(*) FILTER (WHERE "maxAnnual" IS NOT NULL) as has_max_annual,
  COUNT(*) FILTER (WHERE "salaryValidated" = true) as validated,
  COUNT(*) FILTER (WHERE COALESCE("salaryConfidence",0) >= 70) as high_confidence,
  ROUND(AVG(COALESCE("salaryConfidence",0)), 1) as avg_confidence
FROM "Job"
WHERE "isExpired" = false;
