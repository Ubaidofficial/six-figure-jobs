# 6figjobs — Release & QA Spec (v1.0)

## 0) Purpose
A release process that prevents regressions in:
- canonical URLs
- tiering / indexation
- sitemaps
- footer / internal links
- ingest stability
- performance

This doc defines the mandatory checklists for PRs and deployments.

## 1) PR Classification (Pick One)
### A) Safe PR
UI copy tweaks, minor styling, non-routing refactors.
### B) Risk PR (Requires Full QA)
Anything touching:
- `app/**` routes (role/remote/job/company)
- `lib/seo/**`
- slug builders / canonical slug list
- sitemaps (`app/sitemap*.xml/**`)
- footer structure / link generation
- ingest normalization & dedupe logic

## 2) Pre-Merge Checklist (Risk PR)
Must be completed before merge:
- [ ] Confirm no new indexable URL pattern was introduced
- [ ] Confirm canonical role enforcement unchanged (or improved)
- [ ] Confirm Tier-2 roles are not added to sitemaps
- [ ] Confirm sitemap `lastmod` uses real timestamps where required
- [ ] Confirm redirect behavior: bad slugs → 404 (not homepage)
- [ ] Confirm footer matches SEO_SPEC constraints
- [ ] Confirm key pages render without client errors (jobs, job detail, company, remote role)

## 3) Pre-Deploy Checklist
- [ ] DB migrations reviewed (if any)
- [ ] Sitemap routes respond successfully in staging
- [ ] Spot-check: `/remote/[tier1Role]` renders + canonical correct
- [ ] Spot-check: `/jobs/[role]/remote` 301s to `/remote/[role]`
- [ ] Spot-check: Tier-2 role page returns noindex
- [ ] Spot-check: job detail JSON-LD present
- [ ] Ensure robots.txt unchanged or intentionally updated

## 4) Post-Deploy Checklist (Same day)
- [ ] Check logs for redirect spikes or 404 spikes
- [ ] Confirm sitemaps load and contain only allowed URLs
- [ ] Confirm “lastmod” values are not all “now”
- [ ] Confirm homepage stats not fluctuating request-to-request
- [ ] Confirm ingest workflows (daily-scrape) succeeded at least once after deploy
- [ ] Confirm footer links and legal pages load and are content-rich

## 5) SEO Validation (After any SEO/Routing PR)
- [ ] Run a small crawl sample (manual) on top hubs:
  - /remote/[top roles]
  - /{country}/[top roles]
  - /company/[top]
  - /job/[recent]
- [ ] Ensure canonical tags match the URL exactly
- [ ] Ensure noindex where expected
- [ ] Ensure no “parameter URLs” in sitemaps

## 6) Rollback Playbook
Follow `ROLLBACK-PLAN.md` exactly.
Rule:
- Rollback is preferred to “quick fixes” in prod for canonical/sitemap regressions.

## 7) Release Notes Template (Required for Risk PR)
Include:
- what changed
- what URLs were affected
- how canonicalization/indexation was validated
- which checklists were run

---

## Regression Blockers (v2.9 Salary Hard Gates)

Block release if any fail:
- Run `npm run audit:v2.9` (fails on JobPosting JSON-LD leaks, salary-flag qualification leaks, and DB eligibility violations).
- Apply DB migration `prisma/migrations/20251215184500_add_salary_quality_and_salary_aggregates` before deploy.
- Run deterministic backfill after migration: `npm run jobs:backfill:salary-quality:v2.9`.

Expected invariants (must hold in prod):
- No list page emits `JobPosting` JSON-LD (only `/job/*`).
- All listing queries enforce `salaryValidated === true` and `salaryConfidence >= 80` plus currency-aware threshold checks.
- No junior/entry/intern/graduate/new grad jobs appear anywhere.
- No part-time/contract/temporary jobs appear anywhere.


---

## Addendum — Phase D (Location & Work Arrangement Truth)

This spec remains the source of truth; the items below extend it to cover the real production issue we found: **“Global-ish” remote jobs** (especially from Greenhouse) where `remoteRegion = "Global"` is present but not actionable.

### D0 — Audit (required before any code)
**Run on production (read-only):**
- Live job counts per source (remote vs non-remote)
- Global-ish remote counts per source
- Top `locationRaw` patterns per source
- Salary structured coverage per source
- Buckets for global-ish remote (US-only / CA-only / region-only / multi-location / unspecified)

**Exit criteria:** results saved into `docs/RELEASE_AUDIT_v2.9.md` Phase D0 section.

### D1 — Deterministic normalization (non-breaking)
**Principle:** never overwrite raw source truth; instead create normalized fields used for:
- user-facing filters
- JSON-LD emission
- CI audit gates

**Recommended new optional fields (Prisma)**
- `workArrangementNormalized String?`  // remote|hybrid|onsite|unknown
- `remoteGeoScope String?`             // WORLDWIDE|COUNTRY_LIST|REGION_ONLY|UNKNOWN
- `remoteAllowedCountries Json?`       // ["US","CA"] etc
- `remoteAllowedRegions Json?`         // ["EMEA"] etc
- `normalizedLocationJson Json?`       // parsed locations + signals + confidence

**Exit criteria:**
- Deterministic backfill runs idempotently.
- JSON-LD output changes only where normalized fields improve correctness (no regressions).
- CI gate updated to reflect geo-scope classification (see next section).

### CI Blockers (update)
Replace/extend any old blocker like “Remote jobs missing remoteRegion” with:

**Blocker: Remote jobs must be classifiable**
For all live jobs where `remote = true OR remoteMode = 'remote'`:
- Must have `remoteGeoScope` in {WORLDWIDE, COUNTRY_LIST, REGION_ONLY}, OR
- Must have `countryCode` as ISO2 (legacy fallback), OR
- Must be explicitly `workArrangementNormalized != remote` (i.e., we found evidence it’s not remote and corrected the normalized truth)

**Blocker: Non-remote jobs must have a location**
For all live jobs where normalized arrangement is onsite/hybrid:
- Must have one of: city/stateCode/countryCode/locationRaw (non-empty), OR normalizedLocationJson.locations[].

### D2 — “Truth extraction” without breaking data
**Goal:** avoid marking jobs remote unless evidence exists.

Rules:
- Use scraper-provided fields first (best).
- Use deterministic extraction from `locationRaw` second (good).
- Use deterministic extraction from description text third (okay).
- Use AI **only** when ambiguous and only to produce a separate normalized classification + evidence string (never silently flip raw fields).

### Regression tests to add
- Remote worldwide job renders JSON-LD with `jobLocationType=TELECOMMUTE` and no applicant restrictions.
- Remote US-only job renders JSON-LD with `applicantLocationRequirements` Country=United States.
- Remote CA-only job renders JSON-LD with Country=Canada.
- Remote region-only (EMEA) does **not** render invalid applicantLocationRequirements.
- Onsite/hybrid multi-city can emit multiple `jobLocation` entries (array) without empty addresses.
