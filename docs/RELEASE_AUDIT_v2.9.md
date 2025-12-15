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

In addition, v2.9 hardens production safety with:
- Deterministic salary gates
- CI-enforced regression audits
- AI enrichment quality gates
- Explicit protection around destructive scripts

---

## 2. Scope

### 2.1 AI Job Content Enrichment (Primary)
- AI-generated structured summaries derived **strictly** from existing ATS/job description text:
  - One-sentence role summary
  - Responsibilities / key bullets (deduped)
  - Explicit tech stack (no inference)
  - Grounded keywords only
- Short job-card snippet (≤160 chars)
- Stored in additive fields:
  - `aiSummaryJson`
  - `aiSnippet`
  - `aiQualityScore`
  - `aiModel`, `aiVersion`
  - `lastAiEnrichedAt`

### 2.2 UX Improvements (Non-SEO)
- Clear sectioning on job detail pages
- Reduced wall-of-text from raw ATS descriptions
- Better scannability on mobile and desktop
- No new UI elements that generate URLs, filters, or indexable paths

### 2.3 Operational Hardening (from v2.9 work)
- Dangerous scripts isolated under `scripts/_danger/`
- All destructive scripts require explicit `ALLOW_DANGER=true`
- Script references updated to new paths
- Prevents accidental DB resets or mass updates

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

AI-enriched content **renders only inside existing canonical pages**.

---

## 5. Competitor Parity Notes (Conceptual Only)

We match **structure and clarity**, not text or claims.

Observed patterns from RemoteRocketship / Remotive:
- Short role overview at top
- Clear separation of responsibilities vs requirements
- Explicit benefits or highlights
- Salary context explained succinctly
- Clean job card snippets for SERP appeal

We do NOT:
- Copy phrasing
- Copy benefit claims
- Copy salary language

---

## 6. Risk Assessment

| Risk | Level | Mitigation |
|---|---|---|
| AI hallucination | Medium | Conservative prompts, strict JSON schema, null on missing data |
| Low-quality summaries | Medium | AI quality score gate |
| SEO drift | Low | No routing/index changes allowed |
| UX inconsistency | Low | Schema-enforced rendering |
| Accidental destructive scripts | Medium | `_danger/` isolation + env guard |

---

## 7. Rollout Plan

1. Ship additive schema changes (backwards compatible)
2. Enable AI enrichment worker (dark mode, no UI)
3. Enrich a small batch (≤5%)
4. QA factual accuracy and layout parity
5. Gradually enable rendering
6. Require CI audit pass before production enablement

---

## 8. QA Checklist (Must Pass)

- [ ] No sitemap diff
- [ ] No new URLs discovered in crawl
- [ ] Canonicals unchanged
- [ ] AI output validates against strict JSON schema
- [ ] Missing data → null (never invented)
- [ ] Raw ATS description still visible
- [ ] Mobile layout unaffected
- [ ] `npm run audit:ci` passes

---

## 9. Rollback Plan

- Disable AI rendering flag
- Disable enrichment runner
- Ignore AI fields at render time
- No DB rollback required (additive only)

---

## 10. Monitoring

- Google Search Console (coverage, enhancements)
- CTR changes on job pages
- Time-on-page and scroll depth
- AI quality score distribution
- Enrichment failure rate

---

## 11. Acceptance Criteria

v2.9 is successful if:
- Zero new indexed pages appear
- No canonical warnings in GSC
- Job pages show clearer summaries/snippets
- AI quality score ≥3.0 for majority of enriched jobs
- CI audit blocks regressions

---

## 12. Final Verdict

**SAFE TO SHIP**

v2.9 complies with:
- SEO_SPEC.md
- PROJECT_OS
- Zero index bloat mandate
- Non-breaking change policy

---

## 13. Salary Hard Gates (v2.9)

Implemented and enforced:
- [x] Single threshold source: `lib/currency/thresholds.ts`
- [x] Currency-aware salary validation (`validateHighSalaryEligibility`)
- [x] Ingest hard stop for ineligible salaries
- [x] Query gates: `salaryValidated=true`, `salaryConfidence>=80`
- [x] No salary-flag shortcuts in routes or sitemaps
- [x] `JobPosting` JSON-LD only on `/job/*`
- [x] Additive Prisma migration only
- [x] Deterministic backfill + regression scripts

---

## 14. CI & Regression Enforcement

Mandatory gate before deploy:

- `npm run audit:ci` → `scripts/audit-v2.9.ts`

Blocks release if any of the following are detected:
- Published jobs with `salaryValidated=false` or NULL
- Salary confidence below minimum threshold
- Jobs below per-currency salary thresholds
- Banned titles (junior, intern, entry-level) using **word-boundary regex**
- Banned employment types (contract, part-time, temporary)
- Hybrid jobs misclassified as fully remote
- Remote jobs missing `remoteRegion`
- `JobPosting` JSON-LD leakage outside `/job/*`

---

## 15. AI Enrichment — Production Verification

Verified in Railway production:

- Enriched, salary-qualified jobs: **18**
- Enriched jobs missing `aiSummaryJson`: **0**
- All enriched jobs stamped with:
  - `aiModel=deepseek-chat`
  - `aiVersion=v1`
  - `lastAiEnrichedAt` populated

AI enrichment respects:
- Salary gates
- Quality score gate
- Strict factual extraction rules

---

## 16. Script Safety Hardening

- All destructive scripts moved to `scripts/_danger/`
- Execution blocked unless `ALLOW_DANGER=true`
- Prevents accidental DB resets or mass updates during dev/CI

---

**Conclusion:**  
v2.9 safely enhances content quality, strengthens data correctness, and adds hard operational guardrails — without introducing SEO risk or index bloat.
