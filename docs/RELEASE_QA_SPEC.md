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
