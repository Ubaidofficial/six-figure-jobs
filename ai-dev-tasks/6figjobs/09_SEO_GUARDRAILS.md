# SEO Guardrails — 6figjobs

Purpose: protect indexation, canonicals, crawl budget, and prevent SEO regressions.

## Canonical SEO docs
- docs/SEO_SPEC.md
- docs/CHANGE_GATES.md
- ai-dev-tasks/6figjobs/13_GSC_INDEXING_TRIAGE.md

## Hard rules
1) No new indexable route without explicit approval.
2) Canonical must be stable and deterministic.
3) Sitemaps must not include:
   - redirects
   - noindex pages
   - 404 pages
4) Avoid index bloat from filter combinations.
5) Any change affecting:
   - canonical tags
   - robots meta
   - sitemap generation
   - redirects
   must be treated as HIGH RISK until proven safe.

## Required validation
- Sample canonical checks (job pages, company pages, slices)
- Sitemap spot-check: status codes + canonical targets
- GSC classification: map any impact to 13_GSC_INDEXING_TRIAGE.md

