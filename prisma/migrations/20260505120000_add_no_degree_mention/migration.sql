-- AlterTable: add noDegreeMention boolean flag to Job
ALTER TABLE "Job" ADD COLUMN "noDegreeMention" BOOLEAN NOT NULL DEFAULT false;

-- Backfill: mark jobs whose description mentions no-degree keywords
UPDATE "Job"
SET "noDegreeMention" = true
WHERE
  "isExpired" = false
  AND (
    "descriptionHtml" ILIKE '%no degree%'
    OR "descriptionHtml" ILIKE '%without a degree%'
    OR "descriptionHtml" ILIKE '%degree not required%'
    OR "descriptionHtml" ILIKE '%degree preferred%'
    OR "descriptionHtml" ILIKE '%bootcamp%'
    OR "descriptionHtml" ILIKE '%self-taught%'
    OR "descriptionHtml" ILIKE '%equivalent experience%'
    OR "descriptionHtml" ILIKE '%in lieu of degree%'
    OR "descriptionHtml" ILIKE '%or equivalent%'
  );
