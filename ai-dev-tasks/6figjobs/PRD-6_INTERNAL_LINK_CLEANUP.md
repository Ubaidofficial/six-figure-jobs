# PRD — Internal Link Cleanup (P0): Remove “all-roles” Links + Use Canonical Slice URLs

## Type
- Data / Scrapers / SEO

## Motivation
Internal links shape crawl paths, canonical signals, and index bloat. The repo currently generates and hard-codes internal links that are either non-canonical (causing redirect hops) or represent invented URL patterns (“all-roles”) that are not real role slugs.

## Current State (Evidence-Based)
- Slice internal links include an “all roles in country” pattern using a fake role segment:
  - `lib/navigation/internalLinks.ts:61-69` emits `/jobs/${bandSlug}/all-roles/${countrySlug}`.
- Homepage “Popular Six Figure Job Searches” uses legacy/non-canonical slice URL shapes (role-first, country-code, remote-prefix):
  - `app/page.tsx:632-657` includes examples like:
    - `/jobs/software-engineer/100k-plus`
    - `/jobs/us/100k-plus`
    - `/jobs/remote/100k-plus`
- Canonical slice URL shape is defined in the canonical builder:
  - `lib/seo/canonical.ts:28-56` (`/jobs/{band}/{remote?}/{role?}/{country?}/{city?}` with country slug mapping).

## Problem
- “all-roles” links are not a real role taxonomy and can create low-value or misleading pages, risking index bloat and poor crawl efficiency.
- Non-canonical homepage links create redirect hops and duplicate crawl paths, weakening canonical signals and wasting crawl budget.

## Invariants
- Canonical must be stable and deterministic; avoid index bloat from filter combinations: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:8-16`.
- Any change affecting canonicals/redirects is HIGH RISK until proven safe: `ai-dev-tasks/6figjobs/09_SEO_GUARDRAILS.md:17-28`.

## Scope
### In
- `lib/navigation/internalLinks.ts`: remove the `/all-roles/` pattern and replace it with a canonical “country-only” slice link.
- `app/page.tsx`: replace hard-coded legacy slice hrefs with canonical slice URLs (via the canonical builder).

### Out
- Changing which internal links are shown (only URL shapes change).
- Adding new slice types or expanding pSEO coverage.

## Proposal (High-Level)
1. **Remove “all-roles”**: replace `/jobs/{band}/all-roles/{country}` with the canonical country-wide slice URL (no fake role segment), built via the canonical builder.
2. **Homepage canonicalization**: update `app/page.tsx` “Popular searches” links to use canonical slice URLs:
   - Role examples: `/jobs/{band}/{role}`
   - Location examples: `/jobs/{band}/{countrySlug}`
   - Remote examples: `/jobs/{band}/remote`
3. **Single-source URL building**: prefer calling `buildSliceCanonicalPath(...)` (or an exported helper wrapping it) instead of string literals to prevent regressions.

## Risks
- Some updated links may surface missing slice coverage (200 vs 404) if canonical pages are not resolvable for specific combinations; must be validated before shipping.
- Internal link changes may shift crawl distribution; monitor GSC coverage after rollout.

## Success Criteria
- No generated/internal links contain `/all-roles/`.
- Homepage popular search links resolve directly to canonical slice URLs (no redirect hop).
- `npm run lint`, `npm test`, and `npm run build` pass after implementation.

## Verification
Commands (expected results):
```bash
rg -n "all-roles" lib/navigation/internalLinks.ts app
# expected: no output (or only in historical docs/tests)
```

Spot-check (choose a representative country and band):
```bash
curl -I "https://www.6figjobs.com/jobs/100k-plus/united-states"
# expected: 200 and canonical self-matches
```

## Rollback
- Revert the PR (or `git revert <commit>`), then rerun the Verification steps.
- Reference: `docs/ROLLBACK-PLAN.md:1-12` (note: rollback restores previous internal-link shapes).

