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

**Deploy**: Openship (the owner's self-hosted VPS, Docker) since 2026-11-12, building from the **`main`** branch on GitHub. Never push to `main` directly: work on the branch you were given. Auto Deploy and the GitHub webhook are off: merging deploys nothing until the owner deploys in Openship. Deploys are driven by the Openship desktop app on the owner's Mac over SSH (no public controller, tunnel or Openship Cloud), so push-to-deploy needs Openship installed on the VPS with a domain first; the running site does not depend on the Mac. The database moved off Railway on 2026-11-14 (Railway's Postgres was in US-West, the VPS in Europe, about 1 GB/hour over the internet; kept untouched a few days as fallback).
- Database: the Openship `postgres` service (Postgres 17, volume at `/var/lib/postgresql/data`, `PGDATA` in its `pgdata` folder), database and login `sixfig`. The app uses the private address `postgres:5432` in `DATABASE_URL` and `POSTGRES_PRISMA_URL`. GitHub Actions use the public port `62.83.70.147:5433` (`?sslmode=require&sslaccept=accept_invalid_certs`, self-signed TLS) through the relay container `sixfig-db-public` (alpine/socat on the `openship-six-figure-jobs` network, `--restart unless-stopped`); `vars.PRODUCTION_DB_TARGET_FINGERPRINT` is `b10d8cb9baa9e73b`. Containers on that same network cannot reach the public port (hairpin), but the builder can: `BUILD_DATABASE_URL` (public URL) is read only during `next build` (`pickDatabaseUrl` in `lib/prisma.ts`), so pages prerender instead of turning dynamic. Passwords live only in Openship, the GitHub secret and `/root/dbmove` on the VPS (root only). Backups are now the owner's job (Openship Backup tab), not Railway's.
- Deploy only with a service-scoped **Deploy** of the `six-figure-jobs` service. On 2026-11-13 the "Updates available" action and rollbacks started containers without the service's saved `DATABASE_URL`/`POSTGRES_PRISMA_URL` (pointed at the empty Openship Postgres instead): two outages where every page still answered 200 with 0 jobs. "Redeploy Project" is project-level too and is unconfirmed. If one of them is used, check `https://www.6figjobs.com/api/health` right after; if it is not 200, run **Apply environment** on the service.
- Readiness gate: `/api/health` (200 only when the database serves live jobs, else 503; `app/api/health/route.ts`), so a deploy that reaches the wrong database should fail and leave the previous container live.
- Install command `npm ci --include=dev`: service builds see `NODE_ENV=production`, and the build needs devDependencies (`prisma`, `tailwindcss`, `postcss`, `autoprefixer`, `typescript`).
- Production reads `POSTGRES_PRISMA_URL` before `DATABASE_URL` (`lib/prisma.ts`): keep both on the same database. If the database moves, change both, `BUILD_DATABASE_URL`, the GitHub `DATABASE_URL` secret and `vars.PRODUCTION_DB_TARGET_FINGERPRINT` (`scripts/checkDbTarget.ts`) together.
- Since merges no longer deploy, the post-merge "SEO Production Proof" (`.github/workflows/seo-gates.yml`) checks whatever is live, which can be the previous release.

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
