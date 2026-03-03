SELECT
  COUNT(*) FILTER (WHERE "isExpired"=false AND "salaryValidated"=true AND "currency"='AUD' AND ("salaryRaw" ILIKE '%₹%' OR "salaryRaw" ILIKE '%INR%')) as aud_jobs_with_inr_markers,
  COUNT(*) FILTER (WHERE "isExpired"=false AND "salaryValidated"=true AND "currency"='CAD' AND ("salaryRaw" ILIKE '%₹%' OR "salaryRaw" ILIKE '%INR%')) as cad_jobs_with_inr_markers,
  COUNT(*) FILTER (WHERE "isExpired"=false AND "salaryValidated"=true AND "currency"='EUR' AND ("salaryRaw" ILIKE '%₹%' OR "salaryRaw" ILIKE '%INR%')) as eur_jobs_with_inr_markers,
  COUNT(*) FILTER (WHERE "isExpired"=false AND "salaryValidated"=true AND "currency"='GBP' AND ("salaryRaw" ILIKE '%₹%' OR "salaryRaw" ILIKE '%INR%')) as gbp_jobs_with_inr_markers,
  COUNT(*) FILTER (WHERE "isExpired"=false AND "salaryValidated"=true AND ("currency" IS NOT NULL) AND ("salaryRaw" ILIKE '%₹%' OR "salaryRaw" ILIKE '%INR%')) as any_currency_with_inr_markers
FROM "Job";
