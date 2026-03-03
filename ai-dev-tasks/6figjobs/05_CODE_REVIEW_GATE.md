# Code Review Gate — 6figjobs

Purpose: define what "done" means before merge/release.
This is a gate, not a guideline.

## Non-negotiable
- No hallucinated changes: every claim must cite file paths and code.
- No scope creep: only changes approved in PRD/TASKS.
- No SEO regressions: follow docs/SEO_SPEC.md and docs/CHANGE_GATES.md.
- No schema drift: follow ai-dev-tasks/6figjobs/08_SCHEMA_CHANGE_PROTOCOL.md.

## Required checks (minimum)
1) `npm run lint`
2) `npm run audit:ci` (and any repo audit scripts referenced by CI)
3) If schema touched: Prisma generate/migrate steps and migration review
4) If SEO touched: validate canonical, meta robots, sitemap output
5) If scrapers touched: run a targeted scraper smoke test (see 10_SCRAPERS_AUDIT.md)

## Evidence required in PR/notes
- What changed (files)
- Why changed (PRD link)
- How verified (commands + results)
- Risk level (Safe/Medium/High)

