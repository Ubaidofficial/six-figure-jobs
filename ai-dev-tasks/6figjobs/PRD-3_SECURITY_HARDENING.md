# PRD — Security Hardening (P0): Protect Scrape Endpoints, Remove Leaked Secrets, Block SSRF

## Type
- Fix Existing Feature

## Motivation
The repo currently contains (1) an unprotected runtime scraping endpoint, (2) leaked secrets in committed docs, (3) query-param secret auth, and (4) a generic Puppeteer scraper that navigates to DB-sourced URLs without validation (SSRF risk). These are immediate security and operational risks.

## Current State (Evidence-Based)
- Unprotected scrape endpoint:
  - `app/api/scrape/route.ts:49-55` exposes `GET` without any auth check.
- Existing Bearer auth pattern in cron scrape route:
  - `app/api/cron/scrape/route.ts:7-11` checks `Authorization: Bearer ${CRON_SECRET}`.
- Cron AI enrich currently authenticates via query param:
  - `app/api/cron/ai-enrich/route.ts:8-11` reads `?secret=` and compares to `process.env.CRON_SECRET`.
- Secret is committed in documentation:
  - `docs/SEO_SPEC.md:4340` includes a literal `CRON_SECRET=...`.
  - `lib/claude-rules-v2.6.md:4340` includes the same literal `CRON_SECRET=...`.
- SSRF risk in generic scraper:
  - `lib/scrapers/generic.ts:22-28` loads sources from DB (`prisma.companySource.findMany(...)`).
  - `lib/scrapers/generic.ts:55-56` navigates directly to `source.url` via Puppeteer (`page.goto(source.url, ...)`) with no URL validation.

## Problem
- Any unauthenticated caller can trigger scraping/ingest via `/api/scrape`.
- `CRON_SECRET` is leaked in the repo (assume compromise).
- Query param secrets can be logged by infra and leak via referers.
- Generic scraper can be abused (or misconfigured) to access internal/private network URLs (SSRF).

## Invariants
- Secrets must never be committed to the repo (docs included).
- Runtime scrape/cron endpoints must be authenticated.
- Scraping/navigation must not allow private/internal network targets.

## Scope
### In
- Add auth guard to `app/api/scrape/route.ts` (reuse Bearer auth convention from `app/api/cron/scrape/route.ts:7-11`).
- Change `app/api/cron/ai-enrich/route.ts` auth from query param to `Authorization: Bearer ...`.
- Remove leaked `CRON_SECRET` literals from:
  - `docs/SEO_SPEC.md`
  - `lib/claude-rules-v2.6.md`
- Add SSRF URL validation to `lib/scrapers/generic.ts` (block localhost/private IP ranges and unsafe schemes).
- Operational requirement: rotate `CRON_SECRET` in Railway after merge (OUTSIDE REPO).

### Out
- Full authentication system / user auth.
- Broad refactors of scraper architecture.
- Rewriting all scrapers; only the generic scraper’s URL validation is included here.

## Proposal (High-Level)
1. **Protect `/api/scrape`**: require `Authorization: Bearer ${process.env.CRON_SECRET}` (same pattern as cron scrape). Return 401 if missing/invalid.
2. **Harden `/api/cron/ai-enrich`**: replace `?secret=` with `Authorization: Bearer ...` header auth. Keep 401 behavior unchanged.
3. **Remove leaked secrets**: replace literal secrets in docs with placeholders (e.g., `CRON_SECRET=<set-in-Railway>`).
4. **SSRF guard** (`lib/scrapers/generic.ts`):
   - Parse `source.url` with `new URL(...)`.
   - Allow only `http:`/`https:`.
   - Block hostnames: `localhost`, `127.0.0.1`, `0.0.0.0`, `169.254.169.254`.
   - Block private IP ranges: `10.0.0.0/8`, `192.168.0.0/16`, `172.16.0.0/12`.
   - Fail closed (skip source / mark error) when invalid or blocked.
5. **Rotate secret**: after merge, rotate `CRON_SECRET` in Railway and update any cron callers to use the new value.

## Risks
- Existing scheduled jobs may currently call `/api/cron/ai-enrich?secret=...`; they must be updated to send the `Authorization` header to avoid breaking enrichment.
- Blocking private hosts may stop scraping for misconfigured `companySource.url` values; this is desired from a security standpoint.
- Repo history remains compromised even after deleting the literal; rotation is mandatory.

## Success Criteria
- No committed `CRON_SECRET=...` literals remain in the repo.
- Unauthenticated requests to `/api/scrape` and `/api/cron/ai-enrich` return 401.
- Generic scraper blocks private/internal URLs.
- `npm run lint`, `npm test`, and `npm run build` pass after implementation.

## Verification
Commands (expected results):
```bash
rg -n "CRON_SECRET=|6fjbs_cron_" .
# expected: no output

curl -X GET https://www.6figjobs.com/api/scrape
# expected: 401

curl -X GET "https://www.6figjobs.com/api/cron/ai-enrich"
# expected: 401

npm run lint
npm test
npm run build
# expected: all succeed
```

## Rollback
- Revert the PR (or `git revert <commit>`), then rerun the Verification commands.
- Even on rollback, rotate `CRON_SECRET` in Railway (rollback does not remove leaked history).
- Reference: `docs/ROLLBACK-PLAN.md:1-12`.

