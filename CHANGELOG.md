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
