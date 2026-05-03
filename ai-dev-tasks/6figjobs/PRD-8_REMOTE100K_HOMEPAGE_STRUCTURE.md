# PRD-8 - Remote100K-Inspired Homepage Structure

Date: 2026-05-02

## Type
- Fix Existing Feature
- UI / Conversion
- SEO-safe information architecture

## Motivation
The last recommendation was to borrow Remote100K's jobs-first homepage structure without copying its design or link taxonomy. This matters because users landing on 6figjobs should see real, current, high-salary jobs quickly, not only browse modules. It also keeps the product promise visible: verified $100k+ opportunities from trusted companies.

## Competitor Check
Remote100K currently uses:
- A direct $100k+ remote jobs headline.
- Supporting copy that says users can apply directly without an account.
- Company logos near the hero.
- Role/category shortcuts.
- A jobs feed area with showing/sort context.
- Filter groups for role, country, region, and type.

Recommendation: use this as an information-architecture reference only. Do not copy visual styling, exact copy, uncontrolled footer breadth, or non-canonical taxonomy expansion.

## PSEO Confirmation
Yes, this is the right direction for PSEO if implemented narrowly:
- It strengthens the homepage as a crawlable entry point into real, current, high-salary job URLs.
- It improves internal link equity to active job detail pages and approved role/salary/location hubs.
- It keeps search/filter affordances useful for users without turning every filter combination into an indexable URL.
- It avoids the main PSEO failure mode: many thin or duplicate generated pages with little original value.

This is not a recommendation to copy Remote100K wholesale. The PSEO-safe version is jobs-first, canonical-link-first, and salary-trust-first. Any competitor-style category expansion must stay out of sitemaps and out of indexable URL patterns unless `docs/SEO_SPEC.md` explicitly promotes it.

## Current State (Evidence-Based)
- File: `app/page.tsx`
- Evidence: homepage already calls `queryJobs({ isHundredKLocal: true, page: 1, pageSize: PAGE_SIZE, sortBy: 'date', excludeInternships: true })`.
- Evidence: homepage already renders `<LatestOpportunities jobs={jobs} totalJobs={stats.totalJobs} />`.
- Evidence: `LatestOpportunities` appears after `FeaturedCompaniesCarousel`, role links, top locations, salary tiers, premium roles, and `WhySixFigureJobs`.
- File: `components/home/LatestOpportunities.tsx`
- Evidence: the component dedupes to 6 jobs and renders compact bespoke cards.
- File: `components/jobs/JobCard.tsx`
- Evidence: the richer shared card already supports logo, title, salary, location, work type, seniority, snippet, skills, posted time, and canonical job navigation.

## Problem
Jobs technically appear on the homepage, but they are not prominent enough and do not use the richer card structure users see on listings. The hero copy is also broader and more keyword-heavy than the direct jobs-first pattern that Remote100K uses.

## Invariants
- Follow `docs/PROJECT_OS.md`: data correctness over volume.
- Follow salary hard gates: only eligible, validated high-salary jobs should qualify for public listing modules.
- Follow `docs/SEO_SPEC.md`: no new indexable URL patterns unless explicitly approved.
- Follow `docs/ARCHITECTURE_SPEC.md`: homepage stats must remain stable/cached.
- Follow `docs/DESIGN_UX_SPEC.md`: server-rendered lists preferred; filters must not create index bloat.

## Scope
### In
- `app/page.tsx`
- `components/home/Hero.tsx`
- `components/home/Hero.module.css`
- `components/home/LatestOpportunities.tsx`
- `components/home/LatestOpportunities.module.css`
- `components/jobs/JobCard.tsx`
- `components/jobs/JobCard.module.css`
- Focused tests or smoke checks for homepage render and salary-safe card output.

### Out
- No scraper changes.
- No Prisma schema changes.
- No new sitemap family.
- No new indexable filter URL patterns.
- No broad footer taxonomy expansion.
- No redesign of job detail pages.

## Proposal (High-Level)
1. Confirm homepage links stay limited to active job detail URLs and approved canonical hubs.
2. Move latest verified jobs above deeper browse modules.
3. Replace bespoke homepage job cards with the shared `JobCard` structure or a small homepage variant backed by the same data helpers.
4. Simplify the homepage hero to a direct $100k+ jobs promise with search and controlled shortcuts.
5. Keep the company trust strip immediately after the hero.
6. Add a lightweight count/sort header for the homepage feed, such as "Latest verified $100k+ jobs" with total active jobs and a link to `/jobs`.
7. Preserve canonical links for role/salary/location shortcuts.
8. Validate mobile layout so cards remain scannable and text does not overflow.

## Risks
- SEO: uncontrolled filters or copied competitor taxonomy could create index bloat.
- Performance: rendering too many rich cards on the homepage could add client JavaScript or image weight.
- Data trust: displaying salary fallback text as if salary were verified would violate salary integrity.
- UX: moving too many modules below the feed may reduce discovery of salary/location hubs if not balanced.

## Success Criteria
- Homepage shows real jobs above deeper discovery modules.
- Homepage job cards visually and structurally match listing cards.
- Salary labels come from shared salary formatting and do not fabricate `$100k`.
- Search and shortcuts route only to existing approved paths.
- Mobile screenshot shows no overlapping text or unstable card dimensions.
- `npm run seo:validate` passes, or any unrelated pre-existing failures are documented.

## Rollback
Use `docs/ROLLBACK-PLAN.md`. Revert the homepage/card changes in one commit if the layout reduces conversion, causes SEO validation failures, or creates production performance issues.
