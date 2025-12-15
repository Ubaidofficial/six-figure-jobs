# Release Audit — v2.9 (AI Job Content Enrichment)

Project: 6figjobs  
Branch: develop  
Planned Release: v2.9  
Release Type: NON-BREAKING  
Generated: 2025-12-15

---

## 1. Executive Summary

v2.9 introduces **AI-refined job content and improved UX clarity** on existing pages, without changing any SEO-critical surfaces.

This release focuses on:
- Clearer job detail pages
- Higher-quality job card snippets
- Structured, scannable content comparable to leading competitors (RemoteRocketship, Remotive)

**No routing, slug, canonical, sitemap, or indexation behavior is changed.**

---

## 2. Scope (What ships in v2.9)

### 2.1 AI Job Content Enrichment (Primary)
- AI-generated structured summaries derived strictly from existing ATS data:
  - Role overview (3–5 sentences)
  - Responsibilities (deduped bullets)
  - Requirements (hard requirements only)
  - Benefits (structured, factual)
  - “Why this pays $100k+” explanation (derived, non-speculative)
- Short job-card snippet (≤160 chars)

### 2.2 UX Improvements (Non-SEO)
- Clear sectioning on job detail pages
- Reduced wall-of-text from raw ATS descriptions
- Better scannability on mobile and desktop
- No new UI elements that generate URLs or filters

---

## 3. Explicit Non-Goals (Hard Constraints)

This release DOES NOT:
- ❌ Change job URLs or slug formats
- ❌ Modify canonical logic
- ❌ Add or remove sitemap entries
- ❌ Introduce new indexable pages
- ❌ Add blogs, forums, UGC, or comments
- ❌ Expand filters or query-param combinations
- ❌ Replace raw ATS descriptions (they remain source-of-truth)

---

## 4. SEO & Indexation Safety Statement

v2.9 is SEO-neutral by design.

- Canonical URLs: unchanged
- Slugs: unchanged
- Sitemap generation: unchanged
- Robots / noindex logic: unchanged
- Internal linking patterns: unchanged

AI-enriched content **renders inside existing canonical pages only**.

---

## 5. Competitor Parity Notes (Conceptual Only)

We are matching **structure and clarity**, not text or claims.

Observed patterns from RemoteRocketship / Remotive:
- Short role overview at top
- Clear separation of responsibilities vs requirements
- Explicit benefits section
- Salary context explained succinctly
- Clean job card summaries for SERP/snippet appeal

We do NOT:
- Copy phrasing
- Copy benefit claims
- Copy salary language

---

## 6. Risk Assessment

| Risk | Level | Mitigation |
|----|----|----|
| AI hallucination | Medium | Strict prompt rules + null outputs |
| Low-quality summaries | Medium | Quality score gate (0–5) |
| SEO drift | Low | No routing/index changes allowed |
| UX inconsistency | Low | AI output schema enforced |

---

## 7. Rollout Plan

1. Ship schema additions (backwards compatible)
2. Enable AI enrichment worker (dark mode, no UI usage)
3. Populate AI fields for a small batch (≤5%)
4. QA visual parity + factual accuracy
5. Gradually enable rendering of AI sections

---

## 8. QA Checklist (Must Pass)

- [ ] No diff in sitemap output
- [ ] No new URLs discovered in crawl
- [ ] Job canonical unchanged
- [ ] AI output JSON validates against schema
- [ ] Missing data → null (not invented)
- [ ] Raw ATS description still visible
- [ ] Mobile layout unaffected
- [ ] Hybrid jobs are never marked as fully remote
- [ ] Remote jobs always have `remoteRegion`

---

## 9. Rollback Plan

- Disable AI rendering flag
- Ignore AI fields at render time
- No DB rollback required (additive only)

---

## 10. Monitoring

- Google Search Console: coverage + enhancements
- CTR changes on job pages
- Time-on-page and scroll depth
- AI quality score distribution

---

## 11. Acceptance Criteria

v2.9 is successful if:
- Zero new indexed pages appear
- No canonical warnings in GSC
- Job pages show clearer, shorter summaries
- AI quality score ≥3.5 for ≥80% of enriched jobs

---

## 12. Final Verdict

**SAFE TO SHIP**

v2.9 complies with:
- SEO_SPEC.md
- PROJECT_OS
- Zero index bloat mandate
- Non-breaking change policy

---

## 13. Salary Hard Gates (v2.9 Addendum)

Implemented checklist:
- [x] Single threshold source: `lib/currency/thresholds.ts` with `getHighSalaryThresholdAnnual(currency)`.
- [x] Deterministic salary validator: `lib/normalizers/salary.ts` (`validateHighSalaryEligibility`) with currency-aware caps in one place.
- [x] Ingest hardening: `lib/ingest/index.ts` stops forced USD, emits salary quality fields, and skips ineligible jobs.
- [x] Query hard gates: `lib/jobs/queryJobs.ts` enforces `salaryValidated=true`, `salaryConfidence>=80`, and per-currency thresholds; extends global exclusions.
- [x] Title and employment-type bans enforced at ingest and audited in CI using word-boundary matching (prevents false positives such as “International” or “Internal Audit”).
- [x] Location normalization hardened: hybrid/onsite always override remote heuristics; remote jobs require `remoteRegion`.
- [x] Bypass fixes: routes and sitemaps using Prisma now use canonical gate fragments (no salary flags).
- [x] Structured data safety: list pages emit `ItemList` URLs only; `JobPosting` only on `/job/*` via `lib/seo/jobJsonLd.ts` with baseSalary eligibility.
- [x] Job detail UI: Benefits section prefers `aiBenefits`, else `benefitsJson`, else omitted.
- [x] Prisma additions: `Job` salary quality fields + `SalaryAggregate` model + additive migration `prisma/migrations/20251215184500_add_salary_quality_and_salary_aggregates`.
- [x] Data-layer analytics helpers: `lib/salary/aggregates.ts` (no public pages shipped).
- [x] Regression gate: `npm run audit:v2.9` + deterministic backfill script `npm run jobs:backfill:salary-quality:v2.9`.

---

## 14. CI & Regression Enforcement (v2.9)

v2.9 introduces a mandatory CI audit gate that blocks deploys on data or SEO regressions.

Enforced via:
- `npm run audit:ci` (alias of `scripts/audit-v2.9.ts`)

The audit blocks release if any of the following are detected:
- Published jobs with `salaryValidated=false` or low confidence
- Jobs below per-currency salary thresholds
- Banned titles (junior, intern, entry-level, etc.) using word-boundary matching
- Banned employment types (contract, part-time, temporary)
- Hybrid roles misclassified as fully remote
- Remote jobs missing `remoteRegion`
- `JobPosting` JSON-LD leakage outside `/job/*`

This audit is **required** before enabling AI rendering or shipping to production.

---

## 15. Operational Safety Improvements

v2.9 includes operational hardening to reduce production risk.

Changes:
- Destructive maintenance scripts isolated under `scripts/_danger/`
- Explicit environment guard required to execute: `ALLOW_DANGER=true`
- Legacy and duplicate scripts identified and removed from normal execution paths
- All scrapers and importers route exclusively through `lib/ingest/index.ts` (single ingestion authority)

These changes do **not** affect runtime behavior or SEO, but significantly reduce the risk of accidental data loss or unsafe operations in production.

---
