SELECT
  COUNT(*) as companies,
  COUNT(*) FILTER (WHERE "logoUrl" IS NOT NULL AND "logoUrl" <> '') as companies_with_logo,
  ROUND(100.0 * COUNT(*) FILTER (WHERE "logoUrl" IS NOT NULL AND "logoUrl" <> '') / NULLIF(COUNT(*),0), 1) as company_logo_pct
FROM "Company";
