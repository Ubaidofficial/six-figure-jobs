# Release Audit Update Protocol — 6figjobs

Purpose: ensure every meaningful change is captured in release docs.

## Canonical release docs
- docs/RELEASE_AUDIT_v2.9_updated.md (or latest active release audit doc)
- docs/RELEASE_QA_SPEC_updated.md

## Rule
If code changes user-facing behavior, SEO behavior, scrapers, ingestion, or schema:
- update the active release audit doc in the same PR.

## Minimum fields to update
- Change summary
- Risk assessment
- Validation commands + results
- Rollback plan reference (docs/ROLLBACK-PLAN.md)
- Any SEO/GSC impact notes when relevant

