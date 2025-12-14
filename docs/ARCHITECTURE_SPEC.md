# 6figjobs — Architecture Spec (v1.0)

## 0) Purpose
Define the engineering contract for routing, rendering, caching, data access, and canonicalization so changes do not break:
- URL stability (canonical slugs)
- indexation rules (Tier 1 vs Tier 2)
- sitemaps integrity
- performance and reliability

This spec must not conflict with:
- PROJECT_OS.md (authority + change control)
- SEO_SPEC.md (canonical + indexation + sitemap rules)

## 1) System Overview
- Framework: Next.js (App Router)
- Database: Postgres via Prisma
- Rendering: ISR/SSR on key pages; static where safe
- Canonicalization: Central slug system (see SEO_SPEC.md)

## 2) Route Contracts (Do Not Break)
### 2.1 Money Routes (Indexable or controlled)
- `/remote/[role]`
- `/{countrySlug}/[role]`
- `/company/[slug]` (indexable only if quality gates met)
- `/job/[slug]` (indexable only if active + canonical)

### 2.2 Utility Routes (Typically non-indexable)
- `/jobs` browsing, filters/search
- any query-param heavy pages
- pagination pages unless explicitly allowed by SEO_SPEC

## 3) Canonicalization & Param Validation (Hard Requirements)
### 3.1 Canonical role slug must be validated at request-time
For any route that accepts a role:
- If role slug is non-canonical but maps to canonical → 301 to canonical URL.
- If role slug is Tier-2 → allow page render but enforce `noindex` and exclude from sitemaps.
- If role slug is invalid / garbage → 404 (notFound), do not redirect to homepage.

No route may “best-effort slugify” role names.

### 3.2 Canonical URLs: single builder
All internal links MUST be built using shared builders (e.g. `buildJobSlugHref`, role/location builders).
No ad-hoc string concatenation for important URLs.

## 4) Rendering & Caching Policy
### 4.1 ISR defaults
- Money pages: ISR with sane revalidate (e.g. 1h) unless specified.
- Sitemaps: static generation allowed with 24h revalidate unless crawl/freshness dictates otherwise.

### 4.2 Stability requirement for homepage stats
If homepage shows “stats” (jobs count, companies, etc.), it must use cached snapshot logic to avoid fluctuating values on every request.

### 4.3 Avoid per-request expensive joins for listing pages
Listing pages must:
- paginate
- select only needed fields
- avoid N+1 queries

## 5) Data Access Patterns
### 5.1 Prisma usage rules
- Always `select` minimal fields for list views.
- Use `include` only when needed.
- Prefer explicit indexes in DB for hot queries (role, location, isExpired, updatedAt).

### 5.2 Query boundary
Any “complex query logic” should live in `lib/jobs/queryJobs` style modules.
Pages should not contain heavy query construction.

## 6) Errors, Redirects, and 404 Rules
- Use `notFound()` for invalid pages.
- Use `redirect()` only for canonicalization, never as a fallback for unknown slugs.
- 500s must not be used for “missing data” cases; missing = 404 or empty state per SEO_SPEC quality gates.

## 7) Observability (Minimum Standard)
### 7.1 Log critical normalization events
Log at least:
- when a non-canonical role is requested and redirected
- when a request hits Tier-2 route (for monitoring)
- when sitemap generation excludes URLs due to canonical/tier rules

### 7.2 Health checks
Maintain a lightweight endpoint or server log signal that confirms:
- DB reachable
- sitemap route responds
- scrape jobs not failing continuously

## 8) Performance Budget (Guardrails)
These are guardrails, not “nice-to-haves”:
- Avoid heavy client-side JS on SEO landing pages.
- Use `next/image` for logos and images.
- Ensure listing pages render quickly (no large client bundles for filters).

## 9) Change Control Checklist for Architecture PRs
If a PR touches:
- routing under `app/**`
- `lib/seo/**`
- `lib/jobs/**` slug or query logic
- sitemap routes
Then it MUST follow RELEASE_QA_SPEC.md checks before merge.

## 10) Forbidden Patterns (Must Not Ship)
- Creating new indexable URL patterns without SEO_SPEC approval.
- Slugifying role titles to create routes.
- Putting Tier-2 or non-canonical roles into sitemaps.
- Redirecting unknown slugs to homepage.
- Adding filter/query-param pages to sitemaps.
