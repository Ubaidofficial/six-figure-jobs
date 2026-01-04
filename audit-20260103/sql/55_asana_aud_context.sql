WITH s AS (
  SELECT "salaryRaw" as t
  FROM "Job"
  WHERE "id" = 'ats:greenhouse:7302982'
)
SELECT
  CASE WHEN POSITION('AUD' IN t) > 0
    THEN SUBSTRING(t FROM GREATEST(POSITION('AUD' IN t) - 120, 1) FOR 420)
    ELSE NULL
  END as context
FROM s;
