SELECT
  "id",
  "salaryRaw" IS NOT NULL as has_salary_raw,
  COALESCE(LENGTH("salaryRaw"),0) as len,
  (regexp_match(COALESCE("salaryRaw", ''), '(\d{1,3}(?:,\d{3})+\.\d)'))[1] as comma_decimal,
  (regexp_match(COALESCE("salaryRaw", ''), '(\d{1,3}(?:,\d{3})+)'))[1] as comma_thousands,
  (regexp_match(COALESCE("salaryRaw", ''), '(\d+\.\d)'))[1] as dot_decimal
FROM "Job"
WHERE "id" = 'ats:greenhouse:6804253';
