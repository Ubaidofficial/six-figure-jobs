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

**Deploy**: Openship (the owner's self-hosted VPS, Docker) since 2026-11-12, building from the **`main`** branch on GitHub. Never push to `main` directly: work on the branch you were given. Openship's own Auto Deploy and GitHub webhook are off. Openship's controller is also reachable at `https://deploy.ubaid.stream` (since 2026-11-14), and `.github/workflows/deploy-openship.yml` calls the project's incoming webhook (Source & Triggers > Webhooks, set to the `six-figure-jobs` service only, never "Whole project") on every push to `main`, then watches `/api/health`. It needs the repository secrets `OPENSHIP_DEPLOY_URL` and `OPENSHIP_DEPLOY_TOKEN`; until both exist merging deploys nothing and the owner deploys in Openship. **Verified 2026-11-17: both secrets exist and a merge to `main` deploys automatically.** Merging PR #177 started `deploy (Openship)` run 44096971910 within seconds: its `deploy` job succeeded and the `watch` job started, which happens only when Openship accepted the request (`triggered=true`). The webhook deploys the `six-figure-jobs` service only. Do not tell the owner to deploy by hand after a merge; check the run instead, and fall back to a service-scoped Deploy in Openship only if that run did not start or failed. `/api/health` answers 200 on the old version too, so it does not prove the new one is live. Openship also needs a saved read-only GitHub token (Settings > Git > GitHub clone credentials) to clone; without it a deploy fails with "No GitHub credential is available". The running site does not depend on the Mac. The database moved off Railway on 2026-11-14 (Railway's Postgres was in US-West, the VPS in Europe, about 1 GB/hour over the internet; kept untouched a few days as fallback).
- Database: the Openship `postgres` service (Postgres 17, volume at `/var/lib/postgresql/data`, `PGDATA` in its `pgdata` folder), database and login `sixfig`. The app uses the private address `postgres:5432` in `DATABASE_URL` and `POSTGRES_PRISMA_URL`. GitHub Actions use the public port `62.83.70.147:5433` (`?sslmode=require&sslaccept=accept_invalid_certs`, self-signed TLS) through the relay container `sixfig-db-public` (alpine/socat on the `openship-six-figure-jobs` network, `--restart unless-stopped`); `vars.PRODUCTION_DB_TARGET_FINGERPRINT` is `b10d8cb9baa9e73b`. Containers on that same network cannot reach the public port (hairpin), but the builder can: `BUILD_DATABASE_URL` (public URL) is read only during `next build` (`pickDatabaseUrl` in `lib/prisma.ts`), so pages prerender instead of turning dynamic. Passwords live only in Openship, the GitHub secret and `/root/dbmove` on the VPS (root only). Backups are now the owner's job (Openship Backup tab), not Railway's.
- Deploy only with a service-scoped **Deploy** of the `six-figure-jobs` service. On 2026-11-13 the "Updates available" action and rollbacks started containers without the service's saved `DATABASE_URL`/`POSTGRES_PRISMA_URL` (pointed at the empty Openship Postgres instead): two outages where every page still answered 200 with 0 jobs. "Redeploy Project" is project-level too and is unconfirmed. If one of them is used, check `https://www.sixfigurejobs.net/api/health` right after; if it is not 200, run **Apply environment** on the service.
- Readiness gate: `/api/health` (200 only when the database serves live jobs, else 503; `app/api/health/route.ts`), so a deploy that reaches the wrong database should fail and leave the previous container live.
- Install command `npm ci --include=dev`: service builds see `NODE_ENV=production`, and the build needs devDependencies (`prisma`, `tailwindcss`, `postcss`, `autoprefixer`, `typescript`).
- Production reads `POSTGRES_PRISMA_URL` before `DATABASE_URL` (`lib/prisma.ts`): keep both on the same database. If the database moves, change both, `BUILD_DATABASE_URL`, the GitHub `DATABASE_URL` secret and `vars.PRODUCTION_DB_TARGET_FINGERPRINT` (`scripts/checkDbTarget.ts`) together.
- Because a merge deploys only after Openship has built it (about 10 minutes on 2026-11-14), the post-merge "SEO Production Proof" (`.github/workflows/seo-gates.yml`) checks whatever is live, which can be the previous release.

**Pull requests (standing rule from the owner, 2026-11-09)**: when a change is finished, committed and pushed, **always open a PR into `main` right away, without asking or waiting for the owner**, then subscribe to its activity and fix CI failures and review comments. Do not merge it unless the owner says so (the scheduled design refresh in `docs/DESIGN_UX_SPEC.md` §12 has its own merge rule). If the branch's earlier PR was already merged, open a new one.

**Pre-commit hook**: `checkChangelogUpdated.js` blocks commits if `CHANGELOG.md` is not updated. Always add a changelog entry and stage it before committing code files.

**SEO rules**:
- Job pages use ISR (`export const revalidate = 600`). Avoid `force-dynamic` on high-traffic listing pages.
- All canonical URLs must be absolute (`https://www.sixfigurejobs.net/...`), built from `getSiteUrl()` (`lib/seo/site.ts`), never typed in.
- **Domain (owner's decision, 2026-11-22):** the canonical domain is `www.sixfigurejobs.net`; `www.6figjobs.com` (the domain until then) and both apexes 301 to it per path (`SITE_HOSTS` in `lib/seo/site.ts`, `proxy.ts`). Only page loads redirect (GET/HEAD outside `/api/`): webhooks, cron and MCP answer on every host. Keep 6figjobs.com renewed while old links exist. Contact emails stay `@6figjobs.com` until mail is set up on the new domain.
- Hreflang must NOT be emitted on noindex pages (causes GSC warnings).
- Google Jobs requires `JobPosting` JSON-LD with: `title`, `description`, `datePosted`, `hiringOrganization`, `jobLocation` OR `applicantLocationRequirements + remoteJob`.
- `isRemoteJob()` (`lib/seo/jobJsonLd.ts`) must NOT scan `descriptionHtml` or `title` itself — only structured fields (`remoteMode`, `workArrangementNormalized`, `locationRaw`, `remoteRegion`). Description text commonly says "no remote" or "not remote-friendly", so a bare regex over prose gives false positives.
- Exception (owner's ruling, 2026-11-14): description text MAY set those structured fields, but only through `lib/jobs/remoteEvidence.ts`, which reads sentences, handles negation, and returns a verbatim quote that `lib/jobs/verifiedQuote.ts` confirms is in the posting. It fills a field only when the field is empty (never overrides an ATS value), writes `remoteMode` and nothing else (not `remoteRegion`, which holds "Global" by ingest convention; eligible regions come from `countryCode`, see `lib/jobs/remoteRegions.ts`), and is applied by `scripts/backfillRemoteEvidence.ts`, which is a dry run unless `--apply` is passed and writes only `remote` unless `--modes` names `hybrid`/`onsite` too. Because `remoteMode` drives `jobLocationType: TELECOMMUTE` and `applicantLocationRequirements` in JSON-LD, a change to this extractor is an SEO change: flag it in the changelog and re-run the JSON-LD tests.
- **Pay from description text (owner's ruling, 2026-11-15):** when a source gives NO pay in its fields, a yearly range may be read from the posting's own sentences, only through `lib/jobs/payEvidence.ts` (precision first; it returns the verbatim sentence, checked with `verifyQuote`, which is stored as the job's raw salary text). It never replaces pay a source states, never reads hourly/daily/monthly pay, OTE, total compensation with commission, bonuses, equity or per-visit pay, and the usual salary gate (`getMinimumSalaryRejection`) still applies afterwards. It is used by `mapFreehireJob` for freehire jobs that carry no pay fields (`DESCRIPTION_PAY_MARKET` fetches them). A wrong figure reaches the job card and JobPosting `baseSalary`, so a change to this reader is an SEO change: flag it in the changelog, add a failing-then-fixed test for any wrong reading found, and re-run `__tests__/jobs/payEvidence.test.ts`.

**Sitemap**: The sitemap index at `/sitemap.xml` references child sitemaps. `robots.txt` should only list `sitemap.xml` (+ `sitemap-jobs.xml` for Google Jobs discovery, from `INDEXING_PHASE=2`). Do not list all child sitemaps in `robots.txt`. In phase 1 the sitemaps submit hub pages only (home, hubs, salary bands, released pSEO batch, salary guides, countries, published companies); job sitemaps return an empty `<urlset>` until phase 2 (`lib/seo/indexingPhase.ts`, `lib/seo/sitemapPolicy.ts`).

**Sitemap waves (owner's plan, 2026-11-22, for the new domain):** inside phase 1, `SITEMAP_WAVE` (Openship env, default 1, read at request time; `lib/seo/sitemapWaves.ts`) decides what is submitted. Wave 1: home, /jobs, /remote, /companies, /salary, /high-paying-jobs, /high-paying-jobs-report, /blog (index only), /privacy, /terms, /about, /post-a-job. Wave 2 adds the salary bands and blog articles; 3 the Phase 1 role hubs and countries; 4 salary guides, remote role pages and the remaining hubs; 5 pSEO batch 1 and company pages; 6+ one more pSEO batch each. Waves 1-4 change only the sitemap (those pages stay indexable); pSEO batch pages and company pages stay `noindex, follow` until wave 5+. Raise the wave only when Search Console (SEOConsole's indexing monitor) shows most of the current wave indexed. Tests run at wave 8 (`jest.setup.js`).

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
