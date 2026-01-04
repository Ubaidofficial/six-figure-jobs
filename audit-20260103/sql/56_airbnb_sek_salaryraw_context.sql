WITH s AS (
  SELECT "salaryRaw" as t
  FROM "Job"
  WHERE "id" = 'ats:greenhouse:7454771'
)
SELECT
  CASE WHEN POSITION('SEK' IN t) > 0
    THEN SUBSTRING(t FROM GREATEST(POSITION('SEK' IN t) - 160, 1) FOR 420)
    ELSE NULL
  END as context
FROM s;
