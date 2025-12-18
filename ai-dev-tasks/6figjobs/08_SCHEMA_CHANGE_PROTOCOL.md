# Schema Change Protocol — 6figjobs

Purpose: prevent breaking ingestion/SEO/data pipelines via uncontrolled schema changes.

## Canonical sources
- prisma/schema.prisma
- prisma/migrations/*
- docs/DATA_INGEST_SPEC.md (and updated version if active)
- docs/ROLLBACK-PLAN.md

## Non-negotiable rules
1) No schema change without PRD approval.
2) Every schema change must include a migration.
3) Every migration must be reviewed for:
   - backfill needs
   - default values
   - nullability safety
   - index impact
4) If the change affects SEO-visible fields, document it in release audit.

## Required steps (minimum)
- Update prisma/schema.prisma
- Generate migration
- Add backfill script if needed (scripts/)
- Update docs (release audit + ingest spec if applicable)
- Validate in staging/local

