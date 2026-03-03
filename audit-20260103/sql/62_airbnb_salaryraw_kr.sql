SELECT
  "id",
  (CASE WHEN "salaryRaw" ILIKE '% kr%' OR "salaryRaw" ILIKE '%kr %' OR "salaryRaw" ILIKE '% kr.%' THEN true ELSE false END) as has_kr,
  (CASE WHEN "salaryRaw" ILIKE '%SEK%' THEN true ELSE false END) as has_sek,
  (CASE WHEN "salaryRaw" ILIKE '%SGD%' OR "salaryRaw" ILIKE '%S$%' OR "salaryRaw" ILIKE '%SG$%' THEN true ELSE false END) as has_sgd,
  (CASE WHEN "salaryRaw" ILIKE '%$%' THEN true ELSE false END) as has_dollar
FROM "Job"
WHERE "id"='ats:greenhouse:7454771';
