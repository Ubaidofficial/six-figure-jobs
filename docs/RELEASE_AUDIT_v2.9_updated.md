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


---

## Addendum (v2.9 → Phase A/B/C/D Alignment)

**Why this addendum exists:** earlier audits used numbered sections (e.g., 15/16). Recent work has been organized into **Phases A–D**. This addendum keeps the original v2.9 content intact and appends the phase-based execution plan + the concrete changes we made while debugging production data.

### Phase A — JSON-LD correctness for Remote + Worldwide + Multi-geo

**Goal:** Google-valid `JobPosting` JSON-LD without invented physical locations; support:
- truly worldwide remote
- remote restricted to 1+ countries
- remote restricted to region-only labels (EMEA/APAC/etc)
- onsite/hybrid with multiple cities

**Implemented/Decided behavior:**
- Remote jobs emit `jobLocationType: "TELECOMMUTE"` and **do not** emit `jobLocation`.
- Remote jobs emit `applicantLocationRequirements` **only if** we can express a real geo restriction (Country/AdministrativeArea). No placeholders like “Global/Worldwide/Anywhere”.
- When we have multiple allowed countries, `applicantLocationRequirements` may be an **array** of `Country` objects.
- Onsite/hybrid may emit `jobLocation` as a **single** `Place` or an **array** of `Place` when `locationRaw` clearly lists multiple locations (e.g., `;` separated).

**Acceptance tests:**
- JSON-LD passes Google Rich Results test for: remote worldwide, remote US-only, remote CA-only, onsite multi-city.
- No remote job emits an empty `PostalAddress`.
- No `applicantLocationRequirements` value is “Global/Worldwide/Anywhere/Remote”.

### Phase B — Remote geo restriction normalization (Deterministic, no AI)

**Production finding (Dec 16, 2025):**
- Live jobs: **5182 Greenhouse** (1488 remote, 3694 non-remote).
- “Global-ish” remote jobs (countryCode empty OR remoteRegion in GLOBAL/WORLDWIDE/ANYWHERE/INTERNATIONAL):  
  **1488 Greenhouse**, **413 remote100k**, **46 remoteok**, **11 remotive**.
- Many “global-ish” jobs still include strong geo signals in `locationRaw` (e.g., “Remote - USA”, “Remote - Canada”, “Remote - EMEA”).

**Decision:** introduce a deterministic classification layer (Phase D0/D1) that:
- preserves existing raw fields (`locationRaw`, `remoteRegion`, `countryCode`)
- adds **normalized** fields used by UI/filters/SEO and by JSON-LD emission rules
- avoids inventing geo; only emits structured geo when confidently parsed

### Phase C — Data validation gates: evolve the CI blocker

**Important note about the current v2.9 audit gate**
Your audit gate previously treated “Remote jobs missing remoteRegion” as a CI blocker.

But production shows a worse failure mode: `remoteRegion = "Global"` (present but ambiguous). That means “remoteRegion not missing” can still ship invalid/low-value geo data.

**Gate evolution (new blocker rule for Phase D):**
Remote jobs must satisfy **one** of the following:

1) **Worldwide remote**
- explicitly classified as worldwide in a normalized field (see Phase D schema additions), OR
- contains no geo restriction signals (safe to omit applicant restrictions)

2) **Geo-restricted remote (preferred)**
- has a valid ISO2 `countryCode`, OR
- has a normalized country list (ISO2 codes), OR
- has a normalized administrative area restriction (state/province)

3) **Region-only remote (allowed but limited)**
- explicitly classified as `REGION_ONLY` with a normalized region label (EMEA/APAC/LATAM/Americas/Europe)

**Non-remote jobs**
- must have at least one location signal: `city` OR `stateCode` OR `countryCode` OR non-empty `locationRaw`
- must not be marked remote unless supported by evidence (Phase D2)

### Phase D — Location truth + Work arrangement truth (D0 → D3)

> **Very important:** we are not “remote-only”. We list onsite and hybrid roles too.  
> If `remote`/`remoteMode` is wrong or missing, we must infer from *evidence* (scraper fields first, then description-based extraction, then optional AI).

#### D0 — Baseline audit (SQL) + buckets
**Deliverable:** a repeatable SQL dashboard of:
- live jobs per source
- top `locationRaw` patterns per source
- global-ish remote buckets (US-only, CA-only, region-only, multi-location list, unspecified)
- salary structured coverage per source

✅ You already ran core D0 queries and produced baseline counts.

#### D1 — Deterministic normalization (no AI)
**Deliverables:**
- Parser for `locationRaw` → `normalizedLocationJson`
- Derive normalized fields:
  - `workArrangementNormalized`: `remote|hybrid|onsite|unknown`
  - `remoteGeoScope`: `WORLDWIDE|COUNTRY_LIST|REGION_ONLY|UNKNOWN`
  - `remoteAllowedCountries`: ISO2 array when confidently extracted
  - `remoteAllowedRegions`: e.g., `["EMEA"]` when only region label is present
  - `jobLocationPlaces`: array of `{city, region, countryCode}` when extractable

**Rules (high-level):**
- Treat “Hybrid” / “In-Office” / “On-site” as hard signals.
- Treat “Remote - USA/US/United States/U.S.” as US-only.
- Treat “Remote - Canada” as CA-only.
- Treat “Remote - EMEA/APAC/LATAM/Americas/Europe” as region-only.
- Treat “Anywhere in the United States” as US-only.
- Treat semicolon-separated lists as multi-location; parse each segment.

#### D2 — Description-based extraction (low-cost, deterministic first; AI second)
**Deliverables:**
- Lightweight regex extractors over descriptionHtml/Text for:
  - work arrangement (remote/hybrid/onsite)
  - geo restrictions (US-only, CA-only, EU-only, etc.)
- Optional AI enrichment only for **ambiguous** records after deterministic pass.
- Update `remote` / `remoteMode` only when confidence is high; otherwise keep raw and store normalized truth separately.

#### D3 — Scraper hardening + enrichment
**Deliverables:**
- Greenhouse: capture `location` + `workplaceType` when available; preserve multi-location arrays.
- Lever/Ashby/Workday: confirm fields mapped for location + remote + salary.
- Add per-source parsers for salary and benefits; store in structured JSON fields.

---

## Phase D Checklist (copy/paste into PR)

- [ ] D0 SQL baseline captured in docs (counts, top locationRaw, global-ish buckets)
- [ ] Add normalized fields (optional, non-breaking) + indexes
- [ ] Implement deterministic location parser (locationRaw → normalized JSON)
- [ ] Implement work arrangement classifier (remote/hybrid/onsite/unknown)
- [ ] Update JSON-LD emitter to use normalized geo scope:
  - [ ] worldwide: omit applicantLocationRequirements
  - [ ] country list: emit array of `Country`
  - [ ] region-only: do **not** emit invalid pseudo-countries
- [ ] Update CI audit gate to new rule (remote must be classified worldwide/geo-restricted/region-only)
- [ ] Backfill existing live jobs (idempotent script)
- [ ] Re-run Rich Results tests on representative URLs (remote US-only, remote worldwide, onsite multi-city)
