SELECT
  "id",
  (CASE WHEN "salaryRaw" ILIKE '%month%' OR "salaryRaw" ILIKE '%/mo%' THEN true ELSE false END) as has_month,
  (CASE WHEN "salaryRaw" ILIKE '%year%' OR "salaryRaw" ILIKE '%annum%' OR "salaryRaw" ILIKE '%annual%' THEN true ELSE false END) as has_year,
  (regexp_match(COALESCE("salaryRaw", ''), '(\d{1,3}(?:,\d{3})+)'))[1] as first_big_number,
  LEFT(REPLACE(COALESCE("salaryRaw", ''), E'\n', ' '), 240) as sample
FROM "Job"
WHERE "id" = 'ats:greenhouse:7302982';
