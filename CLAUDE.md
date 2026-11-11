# CLAUDE.md — Six Figure Jobs

Engineering guidelines for AI assistants working on this codebase.

---

## 1. Think Before Coding

State your assumptions before touching code. Surface tradeoffs.
If a change could break SEO (canonicals, hreflang, noindex, JSON-LD), flag it explicitly.
If it touches Prisma schema, check for migration requirements.

## 2. Simplicity First

Minimum code. No speculative features. No helper abstractions that wrap a single call.
Prefer CSS Modules over inline styles. Prefer `cn()` for conditional class names.
Avoid adding new dependencies unless genuinely necessary.

## 3. Surgical Changes

Touch only what you must. Read the file before editing.
Never change unrelated code in the same commit.
When fixing a bug, fix the root cause — not the symptom.

## 4. Goal-Driven Execution

Define success before you start: "this page returns 200, canonical is correct, JSON-LD validates."
Loop until verified. Don't stop at "should work."

---

## Project Context

**Stack**: Next.js 15 App Router · TypeScript · Prisma (PostgreSQL) · CSS Modules · Tailwind (utility classes via `cn()`)

**Deploy**: Railway — deploys from the **`main`** branch on GitHub. Never push to `main` directly: work on the branch you were given.

**Pull requests (standing rule from the owner, 2026-11-09)**: when a change is finished, committed and pushed, **always open a PR into `main` right away, without asking or waiting for the owner**, then subscribe to its activity and fix CI failures and review comments. Do not merge it unless the owner says so (the scheduled design refresh in `docs/DESIGN_UX_SPEC.md` §12 has its own merge rule). If the branch's earlier PR was already merged, open a new one.

**Pre-commit hook**: `checkChangelogUpdated.js` blocks commits if `CHANGELOG.md` is not updated. Always add a changelog entry and stage it before committing code files.

**SEO rules**:
- Job pages use ISR (`export const revalidate = 600`). Avoid `force-dynamic` on high-traffic listing pages.
- All canonical URLs must be absolute (`https://www.6figjobs.com/...`).
- Hreflang must NOT be emitted on noindex pages (causes GSC warnings).
- Google Jobs requires `JobPosting` JSON-LD with: `title`, `description`, `datePosted`, `hiringOrganization`, `jobLocation` OR `applicantLocationRequirements + remoteJob`.
- `isRemoteJob()` must NOT scan `descriptionHtml` or `title` — only structured fields (`remoteMode`, `workArrangementNormalized`, `locationRaw`, `remoteRegion`).

**Sitemap**: The sitemap index at `/sitemap.xml` references child sitemaps. `robots.txt` should only list `sitemap.xml` (+ `sitemap-jobs.xml` for Google Jobs discovery, from `INDEXING_PHASE=2`). Do not list all child sitemaps in `robots.txt`. In phase 1 the sitemaps submit hub pages only (home, hubs, salary bands, released pSEO batch, salary guides, countries, published companies); job sitemaps return an empty `<urlset>` until phase 2 (`lib/seo/indexingPhase.ts`, `lib/seo/sitemapPolicy.ts`).

**Component patterns**:
- `JobCard` uses `variant` prop: `'listing'` | `'homepage'` | `'grid'`
- Company logos use white background containers (dark card → invisible logo problem)
- Salary display: only show if `buildSalaryText()` returns a value; no fallback badge
- Location display: `buildLocationDisplay()` handles primaryLocation → locationsJson → fallback chain

**Key directories**:
```
app/               Next.js App Router pages + routes
components/        React components (CSS Modules co-located)
lib/               Business logic, Prisma client, SEO utilities
lib/seo/           Sitemap families, JSON-LD builders, indexability gates
prisma/            Schema + migrations
```

**Competitor reference**: remote100k.com — clean horizontal job cards, left sidebar filters (Role / Country / Region / Type), flat nav (5 items), "Showing X jobs" count. Target that level of simplicity.
