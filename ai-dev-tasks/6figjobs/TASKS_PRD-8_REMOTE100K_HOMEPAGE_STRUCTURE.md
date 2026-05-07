# TASKS - PRD-8 Remote100K-Inspired Homepage Structure

Date: 2026-05-02

## Rules
- One task = one change.
- Must be reversible.
- Only touch files in PRD scope.
- Competitor features are inputs, not requirements.
- No new indexable URL patterns.

## Priority Order
1. **P0 - PSEO guardrails:** preserve canonical links, noindex/sitemap constraints, and salary eligibility before changing layout.
2. **P1 - Jobs feed prominence:** move real active jobs higher on the homepage so users and crawlers reach job URLs sooner.
3. **P1 - Shared job-card structure:** make homepage cards match listing cards for salary trust, location clarity, and richer visible content.
4. **P2 - Hero tightening:** simplify copy and search around the $100k+ promise after the feed/link structure is safe.
5. **P2 - Feed context:** add count/sort context once the feed placement and card structure are stable.
6. **P0 gate before merge - QA:** run SEO and visual checks before shipping.

---

## Task 1 - Confirm PSEO Guardrails
**Type:** seo  
**Risk:** Medium  
**Files:** `app/page.tsx`, `components/home/LatestOpportunities.tsx`, relevant canonical/link helpers if touched

### Steps
1. Inventory every homepage link that will remain above the fold and in the jobs feed.
2. Confirm links resolve to active job detail URLs or approved canonical role/salary/location/company hubs.
3. Confirm no filter/query-param combinations are added to sitemaps or made indexable.
4. Confirm homepage job eligibility still flows through existing high-salary gates.

### Validation
- Spot-check rendered homepage links.
- Run focused SEO validation when implementation lands.
- Confirm no sitemap route changes are required.

### Rollback
- Revert any link additions that introduce unapproved indexable paths.

---

## Task 2 - Move Jobs Feed Higher
**Type:** ui  
**Risk:** Safe  
**Files:** `app/page.tsx`

### Steps
1. Place `LatestOpportunities` immediately after company trust/category shortcuts.
2. Keep salary tiers, top locations, premium roles, and FAQ below the feed.
3. Keep canonical internal links unchanged unless already approved by SEO_SPEC.

### Validation
- Load `/` and confirm jobs are visible in the first practical scroll after hero/trust signals.
- Confirm existing canonical links still point to approved paths.

### Rollback
- Restore previous component order in `app/page.tsx`.

---

## Task 3 - Reuse Listing Job Card Structure
**Type:** refactor  
**Risk:** Medium  
**Files:** `components/home/LatestOpportunities.tsx`, `components/home/LatestOpportunities.module.css`, `components/jobs/JobCard.tsx`, `components/jobs/JobCard.module.css`

### Steps
1. Replace bespoke homepage article markup with shared `JobCard` rendering, or add a small `variant="homepage"` to `JobCard`.
2. Keep salary text from `buildSalaryText`.
3. Keep canonical job links from `buildJobSlugHref`.
4. Limit homepage feed to a performance-safe number of cards.
5. Ensure no card uses fabricated salary fallback text.

### Validation
- Confirm cards show logo/company, title, salary, location, work arrangement, posted time, snippet, and skills when available.
- Confirm keyboard navigation still works.
- Confirm mobile cards do not overflow.

### Rollback
- Restore `LatestOpportunities` bespoke card implementation.

---

## Task 4 - Tighten Homepage Hero
**Type:** ui  
**Risk:** Safe  
**Files:** `components/home/Hero.tsx`, `components/home/Hero.module.css`, `app/page.tsx`

### Steps
1. Replace keyword-heavy hero copy with a direct $100k+ jobs value proposition.
2. Keep server-rendered search.
3. Keep advanced filters controlled and route them through existing search/jobs behavior only.
4. Preserve homepage schema and stable stat usage.

### Validation
- Load `/` on desktop and mobile.
- Confirm H1 remains unique.
- Confirm search submits to the existing route.

### Rollback
- Revert hero component and homepage call-site edits.

---

## Task 5 - Add Feed Context
**Type:** ui  
**Risk:** Safe  
**Files:** `components/home/LatestOpportunities.tsx`, `components/home/LatestOpportunities.module.css`

### Steps
1. Add a compact feed header with latest/sort context and total active jobs.
2. Keep the primary CTA to `/jobs`.
3. Avoid client-only sorting on the homepage unless it already maps to approved server behavior.

### Validation
- Confirm copy is accurate when job count is zero.
- Confirm no layout shift around the header.

### Rollback
- Remove the added feed context.

---

## Task 6 - QA and SEO Guardrails
**Type:** seo  
**Risk:** Medium  
**Files:** relevant changed files only

### Steps
1. Run TypeScript/lint checks available in the repo.
2. Run focused homepage smoke check.
3. Run `npm run seo:validate` if the environment can reach required data.
4. Capture desktop and mobile screenshots if visual tooling is available.

### Validation
- Homepage renders without runtime errors.
- SEO validation passes or failures are documented as unrelated/pre-existing.
- No new sitemaps, routes, or canonical patterns are introduced.

### Rollback
- Revert PRD-8 implementation commit.
