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
