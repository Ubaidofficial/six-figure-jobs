# 6figjobs — Design & UI/UX Spec (v1.0)

## 0) Purpose
Define UI rules that improve conversion, trust, and crawlability without creating SEO debt (index bloat, thin pages, confusing IA).

SEO constraints are owned by SEO_SPEC.md. This spec owns layout, components, accessibility, and conversion patterns.

## 1) Information Architecture (IA)
Primary navigation should emphasize:
- Remote high-paying roles
- High-paying roles by location (country/state hubs as defined)
- Companies (only when meaningful)
- Blog/resources (optional) if high-quality

Avoid exposing large uncontrolled taxonomies (e.g., every city, every tag).

## 2) Jobs Listing Page (e.g., /jobs, /remote/[role], /{country}/{role})
### 2.1 Above-the-fold requirements
- Clear headline + short supporting line
- Visible salary cues (when available)
- Primary filters accessible immediately (role, location, salary, type) without heavy JS

### 2.2 Filter behavior
- Filters should not generate new indexable URL patterns unless approved.
- If filters are query params: keep them `noindex` and never include in sitemaps.
- Provide “reset filters” and show active filter pills.

### 2.3 Listing card requirements
Each job card should show:
- Role title
- Company name + logo (if available)
- Location (Remote/Hybrid/Onsite)
- Salary (formatted if available)
- Posted/updated relative time
- Primary CTA: “View job”

### 2.4 Pagination rules
- Pagination must be usable without infinite scroll.
- If infinite scroll exists, still provide crawlable pagination links for UX and SEO safety.

## 3) Job Detail Page (/job/[slug])
### 3.1 Content structure
- H1 = job title
- Salary block near top (if available)
- Company block (logo, name, optional company page link)
- Apply CTA visible without scrolling; consider sticky CTA on mobile
- Job description readable typography (line-height, max width)

### 3.2 Trust & conversion elements
- “How to apply” section
- “Similar high-paying jobs” module
- “About company” module (if data exists)
- Clear outbound apply link styling and tracking (owned by analytics implementation)

## 4) Company Page (/company/[slug])
### 4.1 Layout
- Company header: logo, name, short summary
- Open roles list
- If no open roles: show graceful empty state + related companies/jobs (do not index thin pages unless SEO_SPEC allows)

## 5) Footer Contract (Must Match SEO_SPEC)
Footer must remain clean and intentional:
- Only Tier-1, canonical hubs where specified
- No “$100k+ jobs by location categories” sections if disallowed
- No “For Job Seekers / For Employers” sections if disallowed
- Legal links must be content-rich; remove DMCA if prohibited
- Anchors should include salary context where required by SEO_SPEC

## 6) Content & Copy Guidelines (UI)
- Avoid keyword stuffing; use natural language.
- Primary headline patterns should align with SEO_SPEC templates.
- Use consistent salary terminology: "$100k+", "six-figure", "high paying" per page intent.

## 7) Accessibility & Quality Bar
Minimum:
- Color contrast meets WCAG AA
- Keyboard navigation for filters and menus
- Visible focus states
- Proper semantic headings (H1 once, structured H2/H3)
- Buttons and links have accessible names

## 8) Performance UX
- Avoid heavy client-only components on SEO landing pages.
- Prefer server-rendered lists; hydrate only interactive filter controls.
- Logos/images must not cause layout shift.

## 9) “Do Not Ship” UX Patterns
- Hiding critical filter UX behind multiple clicks on mobile
- Infinite scroll with no pagination fallback
- UI that creates uncontrolled URL variations
- Long, cluttered footer that repeats internal links excessively

---

## 10) Homepage Jobs-First Direction (Added 2026-05-02)

### Recommendation Checked
Use Remote100K as a structural reference, not a visual copy. The observed useful pattern is:
- Simple value proposition focused on "$100k+" jobs.
- Company trust strip near the top.
- Role/category shortcuts before the main feed.
- A visible jobs count/sort context.
- Jobs shown directly on the homepage.
- Footer/category links kept useful, but not blindly copied because 6figjobs has stricter SEO and footer constraints.

### Current Repo Evidence
- `app/page.tsx` already queries high-salary jobs with `queryJobs(...)` and `PAGE_SIZE = 40`.
- `app/page.tsx` already renders homepage jobs through `LatestOpportunities`, but the section appears after several discovery modules.
- `components/home/LatestOpportunities.tsx` renders a bespoke compact card, while `components/jobs/JobCard.tsx` is the richer listing card with salary, location, work type, seniority, snippet, skills, and verified salary UI.

### Decision
Implement a jobs-first homepage pattern:
- Keep the 6figjobs brand, color system, salary integrity rules, and canonical URL rules.
- Move the live jobs feed higher, immediately after hero/company trust signals.
- Render homepage jobs with the shared listing-card structure, using a homepage density variant if needed.
- Keep role, salary, country, and remote shortcuts as canonical links or controlled search/filter actions.
- Do not add new indexable filtered URL patterns without SEO_SPEC approval.
- Do not expand the footer into uncontrolled competitor-style taxonomy blocks.

### Target Homepage Order
1. Hero with concise $100k+ value proposition and search.
2. Trusted company/logo strip.
3. Role/category shortcuts.
4. Latest verified jobs feed using shared job-card structure.
5. Salary/location/premium-role discovery modules.
6. FAQ and compact canonical internal links.

### Job Card Direction
Homepage cards should match the listing-card information hierarchy:
- Company logo and company name.
- Job title linked to canonical job detail URL.
- Salary displayed only when valid via shared salary formatting.
- Location and work arrangement.
- Posted/updated relative time.
- Optional snippet and top skills when available.
- Primary affordance to view details/apply path.

### Implementation Reference
Detailed implementation planning lives in:
- `ai-dev-tasks/6figjobs/PRD-8_REMOTE100K_HOMEPAGE_STRUCTURE.md`
- `ai-dev-tasks/6figjobs/TASKS_PRD-8_REMOTE100K_HOMEPAGE_STRUCTURE.md`

---

## Recent UX Improvements (December 2025)

### Navigation Enhancement
- Fixed Jobs dropdown staying open (200ms delay)
- Immediate close on link click
- Proper cleanup prevents memory leaks

### Salary Display Clarity
- Job cards: "Minimum: $XXk"
- Homepage: "Starting From"
- Remote page: "Minimum $100k+ USD"

### Search Functionality
- Homepage search verified working
- Submits to /search?q=[query]

### Phase 2 UI/UX Overhaul
- 12,000-word plan ready
- Deploy weeks 3-4 after GSC >30%
- Inspired by RemoteYeah + Remote Rocketship

---

## Recent UX Improvements (December 2025)

### Navigation Enhancement
- Fixed Jobs dropdown staying open (200ms delay)
- Immediate close on link click
- Proper cleanup prevents memory leaks

### Salary Display Clarity
- Job cards: "Minimum: $XXk"
- Homepage: "Starting From"
- Remote page: "Minimum $100k+ USD"

### Search Functionality
- Homepage search verified working
- Submits to /search?q=[query]

### Phase 2 UI/UX Overhaul
- 12,000-word plan ready
- Deploy weeks 3-4 after GSC >30%
- Inspired by RemoteYeah + Remote Rocketship

## Recent Improvements (Dec 2025)
- Navigation: Fixed dropdown (200ms delay)
- Salary: Added 'Minimum' labels
- Search: Verified working

### Phase 2 UI/UX Overhaul (DEPLOYED Dec 2025)
- Enhanced hero section with prominent search
- Improved job card layout (data-rich design)
- Refined typography and spacing
- Updated color scheme and branding
- Mobile-optimized responsive layouts
- Inspired by RemoteYeah + Remote Rocketship aesthetics

---

## 11) Motion (Added 2026-11-07)

### Reference: shadcnspace
`shadcnspace/shadcnspace` (shadcnspace.com) is MIT licensed, so code may be copied or adapted. Any file that copies a substantial part must keep its copyright line in a comment: `Adapted from shadcnspace (MIT, Copyright (c) 2026 Shadcn Space)`.

Almost all of its motion (149 files) is built on the `motion` library (`motion/react`): `AnimatePresence`, `whileHover`/`whileTap`, `whileInView`, `layoutId`, staggered lists. We **borrow the patterns, not the library**:
- `motion` would be a new dependency and adds client JS; every component using it must be `"use client"`.
- Its entrance pattern (`initial={{ opacity: 0 }}` + `whileInView`) ships server HTML that is invisible until hydration, which hurts LCP on our SEO pages.
- shadcnspace is on Tailwind v4; we are on v3.4, so copied class names may need adjusting.

### Rules
- **Never hide content in server HTML.** No entrance animation may start from `opacity: 0` unless it is CSS that leaves the element visible when unsupported (see `reveal-on-scroll`).
- **No motion on SEO-critical content above the fold**: H1, job title on the job page, salary block, apply CTA, job description.
- **CSS first.** Use transitions/keyframes in CSS Modules or `app/globals.css`. Add `motion` only for something CSS cannot do (shared-layout `layoutId` indicators, exit animations of removed list items), behind `LazyMotion`, in a leaf client component.
- **Respect `prefers-reduced-motion`.** Every new animation must be disabled under `reduce`.
- **Hover/press transforms**: hover uses `transform`; press uses `scale`; scroll reveal uses `translate`. These are separate properties so they compose and never override each other.
- Durations: 120 ms press, ~220 ms hover, easing `cubic-bezier(0.22, 1, 0.36, 1)`. Subtle movement only (≤ 4 px lift, ≥ 0.98 scale).

### Patterns in use
| shadcnspace pattern | Our implementation |
|---|---|
| `whileHover` card lift | `components/jobs/JobCard.module.css` `.card:hover` (lift, accent bar, sheen, CTA arrow nudge); homepage rows get a border + background tint |
| `whileTap` press | `.card:active { scale: 0.99 }` |
| `whileInView` reveal / staggered list | `.reveal-on-scroll` in `app/globals.css`: CSS scroll-driven animation (`animation-timeline: view()`) inside `@supports`; zero JS. Used on homepage job rows and the discovery modules below the jobs feed |
| Animated list (items arriving) | `components/home/LiveJobFeed.module.css` `arrive` / `pulse` keyframes |
| `layoutId` sliding indicator | Not used. Candidate for `motion` only if we add tabs/segmented filters |
| `@number-flow/react` counters | Not used (extra dependency) |

---

## 12) Recurring Design Refresh (Added 2026-11-07)

A scheduled Claude Code task runs on the 1st and 15th of each month to keep the public site and the dashboards (`/account`, `/ubaid93`) modern and consistent. Each run:
1. Screenshots key pages on https://www.6figjobs.com (desktop 1440px + mobile 390px): `/`, `/jobs`, one `/job/...` page, `/remote`, `/salary`, one `/company/...` page, `/pricing`. The dashboards are auth-gated, so they are reviewed from code.
2. Picks **at most 3–5 small, focused** visual/UX improvements (spacing, typography, contrast, consistency, motion per §11, mobile layout). No redesigns, no new dependencies without a stated reason.
3. Must not touch SEO-sensitive output (canonicals, hreflang, robots/noindex, JSON-LD, H1 text, sitemaps, URL patterns) or the rules in `CLAUDE.md`.
4. Verifies with `npm run typecheck`, lint on changed files, relevant tests, and a production build; adds a `CHANGELOG.md` entry and a line to the log below.
5. Opens a pull request into `main` and, once its CI checks (`audit`, `SEO Local Gates`) pass, squash-merges it without waiting for review (owner's standing instruction, 2026-11-08). It never pushes directly to `main` (the PR is what runs the CI gates) and never merges a PR with failing or pending checks. Railway then deploys `main`; the run confirms the change is on https://www.6figjobs.com.

### Refresh log
- 2026-11-07: Motion pass from shadcnspace review: JobCard press feedback, homepage row hover tint, CSS scroll reveal on homepage job rows and discovery modules.
