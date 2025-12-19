# Changelog (Human)

This file is for human-curated release notes and noteworthy changes.

Rules:
- Small internal refactors can be omitted.
- Any SEO/indexation, scraper, schema, or user-facing UI change MUST be noted.

If you want auto-generated history, see CHANGELOG.generated.md.

## Unreleased
- Security: redact leaked `CRON_SECRET` examples in docs.
- Security: require `Authorization: Bearer $CRON_SECRET` for `GET /api/scrape`.
- SEO: company sitemap excludes `noindex` companies (`jobCount < 3`).
- SEO: sitemap-browse emits canonical remote URLs (no redirect URLs).

## [P0 Fixes] - 2025-12-19

### PRD-1: Salary Integrity ✅
- Removed salary fabrication from RemoteOK scraper
- Removed salary fabrication from RemoteRocketship scraper
- Removed USD currency fallback from JustJoin scraper
- Added CI guardrail to prevent future salary fabrication

### PRD-2: Sitemap/Indexation Hygiene ✅
- Removed redirect URLs from sitemap-browse.xml
- Fixed soft-404 on invalid location slugs (now returns true 404)
- Added tier robots enforcement on /jobs/[role]
- Aligned slice seed/canonical country slugs
- Added /jobs/[...slug] route for slice pages
- Fixed company sitemap to exclude noindex companies (jobCount >= 3)

### PRD-3: Security Hardening ✅
- Protected /api/scrape with Bearer auth
- Switched /api/cron/ai-enrich to Authorization Bearer
- Removed leaked CRON_SECRET from docs/SEO_SPEC.md
- Removed leaked CRON_SECRET from lib/claude-rules-v2.6.md
- Added SSRF guard to generic scraper
- Rotated CRON_SECRET in Railway

### PRD-4: Salary Display Integrity ✅
- Removed fabricated `$100k` salary fallback in job cards
- Hide “VERIFIED SALARY” badge when salary is missing

### PRD-5: Slice Canonicalization Fixes ✅
- Slice BreadcrumbList JSON-LD uses canonical builder URLs
- Slice canonicalization redirects use `permanentRedirect` (308)
- Job page breadcrumb slice link uses canonical slice URL shape

### PRD-6: Internal Link Cleanup ✅
- Removed `/all-roles/` internal links in slice related links
- Homepage “Popular searches” links use canonical slice URLs

### PRD-7: Sitemap/Category Alignment ✅
- Category sitemap slugs aligned with category resolver (no invalid category URLs)
- Invalid category pages now return true 404 via `notFound()`
