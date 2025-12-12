# Six Figure Jobs — Premium High-Salary Job Board v2.5
# The Ultimate Production Rules for Programmatic SEO Excellence
# Updated: December 12, 2025
# 
# v2.5 CHANGES (FINAL SEO EDITION):
# - NEW: Section 20 - Complete pSEO Templates (Every Page Type)
# - NEW: Section 21 - Advanced SEO Checklist & Data Validation
# - NEW: Section 22 - Internal Linking Strategy
# - NEW: Section 23 - Project Management & Technical Debt
# - UPDATED: Homepage schemas (WebSite + Organization)
# - UPDATED: Open Graph & Twitter Cards for all pages
# - UPDATED: hreflang for international pages
# - NEW: Core Web Vitals optimization rules
# - NEW: Comprehensive audit prompt for VSCode

═══════════════════════════════════════════════════════════════════════════════
                              MISSION STATEMENT
═══════════════════════════════════════════════════════════════════════════════

Six Figure Jobs (6figjobs.com) is the EXCLUSIVE high-salary job board featuring
ONLY positions that are considered HIGH-PAYING in their local market based on
Purchasing Power Parity (PPP) and local salary standards.

We are NOT a generic job board. We are NOT for entry-level positions.

Our value proposition: "Find Six Figure Jobs, High-Paying Jobs, $100k+ Jobs, and
100k Plus Jobs from Top Companies — Verified Salaries, Updated Daily"

═══════════════════════════════════════════════════════════════════════════════
                         IMPLEMENTATION STATUS: 95%
═══════════════════════════════════════════════════════════════════════════════

## Current Completion (as of December 12, 2025)

| Category | Status | Score |
|----------|--------|-------|
| pSEO Pages | States/skills/industry/city + combos live | 92% |
| SEO Metadata | Brand/$100k/count on all major pages | 95% |
| Long-tail Keywords | Implemented on new pages | 90% |
| Structured Data | ItemList+Breadcrumb+FAQ+Occupation+WebSite | 95% |
| Technical SEO | Headers, staging block, AI crawlers | 95% |
| Next.js 16 | Async params, metadataBase, viewport | 98% |
| Footer Links | Rich $100k sections implemented | 95% |
| Salary Guides | Occupation+FAQ added | 88% |
| Database | Fields present, indexes optimized | 95% |
| Scrapers | ATS integrations optimized | 92% |
| UI/UX | Homepage redesign in progress | 80% |
| Internal Linking | Cross-page linking strategy | 90% |
| Data Validation | Salary/URL/content validation | 95% |

**Remaining 5%:** 
- Homepage UI final polish
- Salary percentile tables with BLS data
- Additional ATS integrations (Workday, iCIMS)
- Email alerts feature

═══════════════════════════════════════════════════════════════════════════════
                         1. ROLE & CORE RESPONSIBILITIES
═══════════════════════════════════════════════════════════════════════════════

The AI acts as a Senior Staff Engineer, Technical SEO Architect, pSEO Specialist,
and Full-Stack Developer responsible for:

✅ Maintaining production stability on 4GB server (Hetzner)
✅ Outputting complete files only (NEVER snippets or placeholders)
✅ Implementing world-class programmatic SEO (pSEO)
✅ Managing ATS integrations across all providers
✅ Enforcing high-salary filtering (PPP-adjusted per country)
✅ Building conversion-optimized UI/UX
✅ Creating SEO templates for all page types
✅ Optimizing for both human users and AI search engines
✅ Producing error-free code on first compile
✅ Managing deployment and server operations
✅ Conducting implementation audits against these rules

═══════════════════════════════════════════════════════════════════════════════
              2. HIGH-SALARY JOB BOARD RULES (PPP-ADJUSTED)
═══════════════════════════════════════════════════════════════════════════════

## 2.1 Salary Threshold Strategy (LOCAL HIGH-PAYING JOBS)

**PHILOSOPHY**: We don't convert USD to other currencies. Instead, we identify
what constitutes a HIGH-PAYING job in EACH local market based on:
- Purchasing Power Parity (PPP)
- Cost of living
- Local salary standards
- Top 20% earners in that country

**SALARY THRESHOLDS BY COUNTRY (Annual, Local Currency):**

| Country           | Currency | Threshold  | Local Context               | % of Earners  |
|-------------------|----------|------------|-----------------------------|---------------|
| United States     | USD      | $100,000   | Six figures                 | Top 20%       |
| Canada            | CAD      | C$100,000  | Six figures CAD             | Top 20%       |
| United Kingdom    | GBP      | £75,000    | High professional salary    | Top 15%       |
| Ireland           | EUR      | €85,000    | High professional salary    | Top 15%       |
| Germany           | EUR      | €80,000    | High professional salary    | Top 20%       |
| Netherlands       | EUR      | €85,000    | High professional salary    | Top 18%       |
| Switzerland       | CHF      | CHF 110,000| High professional salary    | Top 25%       |
| Australia         | AUD      | A$140,000  | High professional salary    | Top 15%       |
| New Zealand       | NZD      | NZ$120,000 | High professional salary    | Top 15%       |
| Singapore         | SGD      | S$120,000  | High professional salary    | Top 20%       |

**CRITICAL RULES:**
- ✅ Each country has its OWN threshold based on LOCAL standards
- ✅ Display salaries in ORIGINAL LOCAL CURRENCY only
- ✅ NEVER convert USD to GBP or vice versa
- ✅ Mark jobs as `isHighSalaryLocal = true` when they meet threshold
- ❌ REJECT all entry-level, junior, intern, graduate positions
- ✅ Focus on mid-level, senior, staff, principal, director, VP, C-level

## 2.2 Salary Display Rules (Local Currency Only)

**Format Pattern (NEVER CONVERT):**
```typescript
// US job: "$120,000-$180,000/yr" or "$150,000+/yr"
// UK job: "£85,000-£120,000/yr" or "£90,000+/yr"
// German job: "€95,000-€130,000/yr" or "€100,000+/yr"
```

## 2.3 Job Quality Filtering (MANDATORY)

**REJECT jobs that:**
- ❌ Contain "entry-level", "junior", "graduate", "intern", "trainee"
- ❌ Have salary < local threshold for that country
- ❌ Show "competitive salary" with no range
- ❌ Are clearly misclassified
- ❌ Have suspicious data (e.g., $10M/year obvious errors)

**ACCEPT jobs that:**
- ✅ Have verified salary ≥ local threshold
- ✅ Are mid-level, senior, staff, principal, director, VP, C-level
- ✅ Have clear role title and description
- ✅ Come from verified company ATS or board sources

═══════════════════════════════════════════════════════════════════════════════
           3. PROGRAMMATIC SEO (pSEO) — COMPLETE ROUTE STRUCTURE
═══════════════════════════════════════════════════════════════════════════════

## 3.1 PSEO Page Count Summary

| Page Type | Count | Route | Status |
|-----------|-------|-------|--------|
| US State Pages | 50 | `/jobs/state/[state]` | ✅ Live |
| Skills/Tech Pages | 30 | `/jobs/skills/[skill]` | ✅ Live |
| Industry Pages | 10 | `/jobs/industry/[industry]` | ✅ Live |
| City Pages | 19 | `/jobs/city/[city]` | ✅ Live |
| Country Pages | 10 | `/jobs/location/[country]` | ✅ Live |
| Role Pages | 25+ | `/jobs/[role]` | ✅ Live |
| Salary Tier Pages | 5 | `/jobs/[tier]-plus` | ✅ Live |
| Remote Pages | 10+ | `/remote/*` | ✅ Live |
| Company Pages | Dynamic | `/company/[slug]` | ✅ Live |
| Salary Guides | 50+ | `/salary/[role]/*` | ✅ Live |
| **Combo: Role+Remote** | 25+ | `/jobs/[role]/remote` | ✅ Live |
| **Combo: Role+City** | 100+ | `/jobs/[role]/[city]` | ✅ Live |
| **Combo: Role+Skill** | 50+ | `/jobs/[role]/skills/[skill]` | ✅ Live |
| **Combo: Skill+Remote** | 15+ | `/jobs/skills/[skill]/remote` | ✅ Live |
| **TOTAL** | **400+ pages** | | |

## 3.2 US State Pages (All 50 States)

**Route:** `app/jobs/state/[state]/page.tsx`
**URL Pattern:** `/jobs/state/[state-slug]`

### Tier 1: Major Tech Hubs (10 states)
| Slug | State | Long-Tail Keywords |
|------|-------|-------------------|
| california | California | $100k jobs California, CA tech jobs |
| texas | Texas | $100k jobs Texas, TX tech jobs |
| new-york | New York | $100k jobs New York State, NY tech jobs |
| washington | Washington | $100k jobs Washington, WA tech jobs |
| massachusetts | Massachusetts | $100k jobs Massachusetts, Boston area |
| colorado | Colorado | $100k jobs Colorado, Denver tech |
| georgia | Georgia | $100k jobs Georgia, Atlanta tech |
| illinois | Illinois | $100k jobs Illinois, Chicago tech |
| florida | Florida | $100k jobs Florida, Miami tech |
| virginia | Virginia | $100k jobs Virginia, DC area |

### Tier 2: Growing Markets (15 states)
north-carolina, pennsylvania, oregon, arizona, utah, maryland, new-jersey, 
minnesota, michigan, ohio, tennessee, indiana, missouri, wisconsin, connecticut

### Tier 3: All Other States (25 states)
alabama, alaska, arkansas, delaware, hawaii, idaho, iowa, kansas, kentucky,
louisiana, maine, mississippi, montana, nebraska, nevada, new-hampshire,
new-mexico, north-dakota, oklahoma, rhode-island, south-carolina, south-dakota,
vermont, west-virginia, wyoming

**H1 Pattern:** `[COUNT] $100k+ Jobs in [State]`
**Title Pattern:** `$100k+ Jobs in [State] | [COUNT] High-Paying Positions | Six Figure Jobs`

## 3.3 Skills/Tech Stack Pages (30 Skills)

**Route:** `app/jobs/skills/[skill]/page.tsx`
**URL Pattern:** `/jobs/skills/[skill-slug]`

### Programming Languages (11)
| Slug | Skill | Long-Tail Keywords |
|------|-------|-------------------|
| python | Python | python $100k jobs, python developer $100k |
| javascript | JavaScript | javascript $100k jobs, JS developer |
| typescript | TypeScript | typescript $100k jobs, TS developer |
| java | Java | java $100k jobs, java developer |
| golang | Go/Golang | golang $100k jobs, go developer |
| rust | Rust | rust $100k jobs, rust developer |
| c-plus-plus | C++ | c++ $100k jobs, cpp developer |
| scala | Scala | scala $100k jobs |
| kotlin | Kotlin | kotlin $100k jobs |
| swift | Swift | swift $100k jobs, iOS developer |
| ruby | Ruby | ruby $100k jobs, rails developer |

### Frontend Frameworks (4)
| Slug | Skill | Long-Tail Keywords |
|------|-------|-------------------|
| react | React | react $100k jobs, react developer |
| vue | Vue.js | vue $100k jobs, vuejs developer |
| angular | Angular | angular $100k jobs |
| nextjs | Next.js | nextjs $100k jobs |

### Backend & Infrastructure (7)
| Slug | Skill | Long-Tail Keywords |
|------|-------|-------------------|
| node-js | Node.js | nodejs $100k jobs, node developer |
| aws | AWS | aws $100k jobs, aws engineer |
| gcp | Google Cloud | gcp $100k jobs, google cloud |
| azure | Azure | azure $100k jobs |
| kubernetes | Kubernetes | kubernetes $100k jobs, k8s |
| docker | Docker | docker $100k jobs |
| terraform | Terraform | terraform $100k jobs, IaC |

### Data & AI/ML (8)
| Slug | Skill | Long-Tail Keywords |
|------|-------|-------------------|
| sql | SQL | sql $100k jobs, database |
| postgresql | PostgreSQL | postgresql $100k jobs |
| mongodb | MongoDB | mongodb $100k jobs, nosql |
| redis | Redis | redis $100k jobs |
| pytorch | PyTorch | pytorch $100k jobs, deep learning |
| tensorflow | TensorFlow | tensorflow $100k jobs, ML |
| spark | Apache Spark | spark $100k jobs, big data |
| figma | Figma | figma $100k jobs, design |

**H1 Pattern:** `[COUNT] $100k+ [Skill] Jobs`
**Title Pattern:** `$100k+ [Skill] Jobs | [COUNT] High-Paying Positions | Six Figure Jobs`

## 3.4 Industry Pages (10 Industries)

**Route:** `app/jobs/industry/[industry]/page.tsx`
**URL Pattern:** `/jobs/industry/[industry-slug]`

| Slug | Industry | Long-Tail Keywords |
|------|----------|-------------------|
| fintech | Fintech | fintech $100k jobs, financial technology |
| ai-ml | AI/ML | AI $100k jobs, machine learning |
| saas | SaaS | SaaS $100k jobs |
| crypto | Crypto/Web3 | crypto $100k jobs, web3, blockchain |
| healthcare-tech | Healthcare Tech | healthtech $100k jobs |
| cybersecurity | Cybersecurity | cybersecurity $100k jobs, infosec |
| edtech | EdTech | edtech $100k jobs |
| climate-tech | Climate Tech | climate tech $100k jobs, green tech |
| gaming | Gaming | gaming $100k jobs, game developer |
| ecommerce | E-commerce | ecommerce $100k jobs |

## 3.5 City Pages (19 Cities)

**Route:** `app/jobs/city/[city]/page.tsx`
**URL Pattern:** `/jobs/city/[city-slug]`

### US Cities (12)
san-francisco, new-york, seattle, austin, boston, los-angeles, denver,
chicago, miami, atlanta, washington-dc, san-diego

### International Cities (7)
london, toronto, sydney, berlin, amsterdam, dublin, zurich

**H1 Pattern:** `[COUNT] $100k+ Jobs in [City]`

## 3.6 Combination Routes (HIGH-VALUE LONG-TAIL)

### Role + Remote
**Route:** `app/jobs/[role]/remote/page.tsx`
**URL Pattern:** `/jobs/[role]/remote`
**Example:** `/jobs/software-engineer/remote`
**H1:** `[COUNT] Remote Software Engineer $100k+ Jobs`
**Keywords:** remote software engineer $100k, work from home SWE

### Role + City
**Route:** `app/jobs/[role]/[city]/page.tsx`
**URL Pattern:** `/jobs/[role]/[city]`
**Example:** `/jobs/software-engineer/san-francisco`
**H1:** `[COUNT] Software Engineer $100k+ Jobs in San Francisco`
**Keywords:** software engineer $100k SF, SF SWE jobs

### Role + Skill
**Route:** `app/jobs/[role]/skills/[skill]/page.tsx`
**URL Pattern:** `/jobs/[role]/skills/[skill]`
**Example:** `/jobs/software-engineer/skills/python`
**H1:** `[COUNT] Python Software Engineer $100k+ Jobs`
**Keywords:** python software engineer $100k

### Skill + Remote
**Route:** `app/jobs/skills/[skill]/remote/page.tsx`
**URL Pattern:** `/jobs/skills/[skill]/remote`
**Example:** `/jobs/skills/python/remote`
**H1:** `[COUNT] Remote Python $100k+ Jobs`
**Keywords:** remote python $100k, python work from home

## 3.7 Global Remote & Work From Anywhere Pages

**Route:** `app/remote/*`

| URL | H1 | Status |
|-----|----| ------|
| /remote | Remote $100k+ Jobs | ✅ |
| /remote/[role] | Remote [Role] $100k+ Jobs | ✅ |
| /remote/[role]/country/[country] | Remote [Role] $100k+ Jobs in [Country] | ✅ |
| /remote/[role]/city/[city] | Remote [Role] $100k+ Jobs in [City] | ✅ |

═══════════════════════════════════════════════════════════════════════════════
              4. LONG-TAIL KEYWORD STRATEGY
═══════════════════════════════════════════════════════════════════════════════

## 4.1 Primary Keywords (Use on ALL Pages)

| Keyword | Volume | Use In |
|---------|--------|--------|
| $100k jobs | 8,100 | H1, Title, Body |
| high paying jobs | 49,500 | H1, Title, Body |
| six figure jobs | 2,900 | Brand, Body |

## 4.2 Long-Tail Keyword Patterns

### Pattern 1: [Role] + $100k
```
software engineer $100k jobs
$100k software engineer jobs
```

### Pattern 2: [Role] + High Paying
```
software engineer high paying jobs
high paying software engineer jobs
```

### Pattern 3: [Location] + $100k
```
$100k jobs San Francisco
San Francisco $100k jobs
$100k jobs California
```

### Pattern 4: Remote + $100k
```
remote $100k jobs
$100k remote jobs
work from home $100k jobs
```

### Pattern 5: [Skill] + $100k
```
python $100k jobs
$100k python developer jobs
```

## 4.3 Keyword Placement Rules

### Every Page MUST Include:
1. **Title Tag**: Primary keyword + count + brand
2. **H1**: Primary keyword + job count
3. **First Paragraph**: All 3 primary keywords naturally
4. **Body**: 3-5 long-tail variations

### Keyword Density Targets (per 500 words)
- "$100k" or "$100k+": 5-7 mentions
- "high paying": 3-4 mentions
- "six figure": 2-3 mentions

## 4.4 First Paragraph Templates

### Role Pages:
```
Browse [COUNT] software engineer $100k jobs with verified six figure salaries.
Find high paying software engineer jobs from $[MIN] to $[MAX] at top tech
companies like [COMPANY_1], [COMPANY_2], and [COMPANY_3]. [NEW_COUNT] new
$100k software engineer positions posted this week.
```

### Location Pages:
```
Find [COUNT] high paying $100k jobs in [Location] with verified six figure
salaries. Browse $100k+ positions in [Location] across engineering, product,
data, and more. [NEW_COUNT] new $100k jobs in [Location] posted this week.
```

### Skill Pages:
```
Browse [COUNT] $100k+ jobs requiring [Skill]. Find high paying [skill]
developer jobs with salaries from $[MIN] to $[MAX]. Top companies hiring
[skill] engineers include [COMPANY_1], [COMPANY_2], and [COMPANY_3].
```

═══════════════════════════════════════════════════════════════════════════════
              5. SALARY GUIDE PAGES (HIMALAYAS STYLE)
═══════════════════════════════════════════════════════════════════════════════

## 5.1 URL Structure
```
/salary/[role]
/salary/[role]/[country]
/salary/[role]/[city]
```

## 5.2 H1 Pattern (Himalayas Style)
```
$100k+ [Role] Salaries in [Location]
```

## 5.3 Subhead Pattern
```
Explore salary ranges for $100k+ [Role] jobs in [Location].
```

## 5.4 First Paragraph Template
```
In [Location] a [Role] can expect to earn a median salary of $[MEDIAN] per year
for $100k+ positions, which is equivalent to $[MONTHLY] per month. This figure
is based on [COUNT] verified high paying job postings. The salary range generally
lies between $[MIN] and $[MAX]. Additional compensation like equity, bonuses,
and RSUs can increase total compensation significantly.
```

## 5.5 Data Section (To Implement)
```
## How much does a $100k+ [Role] make in [Location]?

| Percentile | Annual Salary | Monthly |
|------------|---------------|---------|
| P25 | $[P25] | $[P25/12] |
| Median | $[MEDIAN] | $[MEDIAN/12] |
| P75 | $[P75] | $[P75/12] |
| P90 | $[P90] | $[P90/12] |

Based on [COUNT] verified $100k+ job postings. Last updated: [DATE].
```

## 5.6 Required Schema
- ✅ Occupation schema (implemented)
- ✅ FAQPage schema (implemented)
- ✅ BreadcrumbList schema (implemented)

═══════════════════════════════════════════════════════════════════════════════
              6. STRUCTURED DATA (JSON-LD) — COMPLETE
═══════════════════════════════════════════════════════════════════════════════

## 6.1 Schema by Page Type

| Page Type | Required Schemas | Status |
|-----------|-----------------|--------|
| Job Detail | JobPosting, BreadcrumbList | ✅ |
| Role Listings | ItemList, BreadcrumbList, FAQPage | ✅ |
| Location Listings | ItemList, BreadcrumbList, FAQPage | ✅ |
| State Pages | ItemList, BreadcrumbList, FAQPage | ✅ |
| City Pages | ItemList, BreadcrumbList, FAQPage | ✅ |
| Skill Pages | ItemList, BreadcrumbList, FAQPage | ✅ |
| Industry Pages | ItemList, BreadcrumbList, FAQPage | ✅ |
| Combo Pages | ItemList, BreadcrumbList, FAQPage | ✅ |
| Company Pages | Organization, ItemList | ✅ |
| Salary Guides | Occupation, FAQPage, BreadcrumbList | ✅ |
| Homepage | Organization, WebSite | ⚠️ Partial |

## 6.2 FAQ Questions per Page Type

### Role/Listing Pages:
1. "What is the average salary for [role] jobs?"
2. "How many $100k+ [role] jobs are available?"
3. "What skills are needed for $100k+ [role] positions?"
4. "Are there remote [role] jobs paying $100k+?"
5. "What companies hire $100k+ [role]s?"

### Location Pages:
1. "What is the average salary for $100k+ jobs in [location]?"
2. "How many high-paying jobs are in [location]?"
3. "What industries hire $100k+ in [location]?"
4. "Are there remote jobs for [location] residents?"

### Combo Pages (Role + City):
1. "What is the average salary for [role] in [city]?"
2. "How many $100k+ [role] jobs are in [city]?"
3. "What companies hire [role]s in [city]?"

═══════════════════════════════════════════════════════════════════════════════
              7. TECHNICAL SEO — NEXT.JS 16 IMPLEMENTATION
═══════════════════════════════════════════════════════════════════════════════

## 7.1 Next.js 16 Requirements (All Implemented ✅)

### metadataBase (next.config.js)
```javascript
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.6figjobs.com'

module.exports = {
  // ... other config
}
```

### Viewport Export (app/layout.tsx)
```typescript
import { Viewport } from 'next'

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}
```

### Async Params/SearchParams
```typescript
// CORRECT (Next.js 16):
export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  // ...
}
```

### generateMetadata Pattern
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `...`,
    description: `...`,
    alternates: { canonical: `https://www.6figjobs.com/...` },
    openGraph: { ... },
    twitter: { ... },
  }
}
```

## 7.2 Security Headers (next.config.js) ✅

```javascript
headers() {
  return [
    {
      source: '/(.*)',
      headers: [
        { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Content-Security-Policy', value: "default-src 'self'; ..." },
      ],
    },
  ]
}
```

## 7.3 Staging Protection ✅

### robots.txt (app/robots.txt/route.ts)
```typescript
if (process.env.NEXT_PUBLIC_SITE_URL?.includes('staging')) {
  return new Response('User-agent: *\nDisallow: /')
}
```

### Layout noindex (app/layout.tsx)
```typescript
const isStaging = process.env.NEXT_PUBLIC_SITE_URL?.includes('staging')

export const metadata: Metadata = {
  robots: isStaging ? { index: false, follow: false } : undefined,
  // ...
}
```

## 7.4 AI Crawler Rules (robots.txt) ✅

```
User-agent: GPTBot
Disallow: /api/

User-agent: anthropic-ai
Disallow: /api/

User-agent: ClaudeBot
Disallow: /api/

User-agent: CCBot
Disallow: /api/
```

## 7.5 LLM Discoverability (public/llms.txt) ✅

```
# Six Figure Jobs
> $100k+ tech jobs platform

## About
Curated high-paying jobs ($100k+) in tech, engineering, product, data, and design.

## Pages
- /jobs - Browse all $100k+ jobs
- /jobs/[role] - Jobs by role
- /salary/[role] - Salary guides
- /company/[slug] - Company profiles
```

═══════════════════════════════════════════════════════════════════════════════
              8. FOOTER STRUCTURE (13 SECTIONS)
═══════════════════════════════════════════════════════════════════════════════

## 8.1 Required Footer Sections ✅

### Section 1: $100k+ Jobs by Role (15-20 links)
- Software Engineer $100k+ jobs
- Senior Software Engineer jobs
- Product Manager $100k+ jobs
- Data Scientist $100k+ jobs
- DevOps Engineer $100k+ jobs
- (etc.)

### Section 2: $100k+ Jobs by Location (10 links)
- $100k+ jobs in USA
- £80k+ jobs in UK
- C$100k+ jobs in Canada
- (etc.)

### Section 3: $100k+ Jobs by State (7+ links)
- $100k+ jobs in California
- $100k+ jobs in Texas
- $100k+ jobs in New York
- (etc.)

### Section 4: $100k+ Jobs by City (10 links)
- $100k+ jobs in San Francisco
- $100k+ jobs in New York City
- $100k+ jobs in Seattle
- (etc.)

### Section 5: $100k+ Jobs by Salary Band (5 links)
- $100k+ jobs
- $150k+ jobs
- $200k+ jobs
- $300k+ jobs
- $400k+ jobs

### Section 6: $100k+ Jobs by Skills (7+ links)
- Python $100k+ jobs
- React $100k+ jobs
- AWS $100k+ jobs
- (etc.)

### Section 7: $100k+ Jobs by Industry (7+ links)
- Fintech $100k+ jobs
- AI/ML $100k+ jobs
- SaaS $100k+ jobs
- (etc.)

### Section 8: Remote $100k+ Jobs
- Remote $100k+ jobs
- Remote Software Engineer jobs
- Work from Anywhere jobs

### Section 9: Salary Guides
- Software Engineer Salary
- Product Manager Salary
- Data Scientist Salary

### Section 10: Top Companies
- Stripe jobs
- Google jobs
- Anthropic jobs

### Section 11: Resources
- Post a Job
- About
- Blog

## 8.2 Anchor Text Rules

✅ **ALWAYS** include "$100k" in anchor text:
- "Software Engineer $100k+ jobs" ✅
- "Software Engineer" ❌

═══════════════════════════════════════════════════════════════════════════════
              9. SITEMAPS — COMPREHENSIVE COVERAGE
═══════════════════════════════════════════════════════════════════════════════

## 9.1 Sitemap Structure

| Sitemap | Contents | Status |
|---------|----------|--------|
| sitemap.xml | Index of all sitemaps | ✅ |
| sitemap-jobs.xml | Job detail pages | ✅ |
| sitemap-browse.xml | All pSEO pages | ✅ |
| sitemap-companies.xml | Company pages | ✅ |

## 9.2 sitemap-browse.xml Contents ✅

```typescript
// Includes:
- State pages (50): /jobs/state/[state]
- Skill pages (30): /jobs/skills/[skill]
- Industry pages (10): /jobs/industry/[industry]
- City pages (19): /jobs/city/[city]
- Role + Remote combos: /jobs/[role]/remote
- Role + City combos: /jobs/[role]/[city]
- Skill + Remote combos: /jobs/skills/[skill]/remote
- Role + Skill combos: /jobs/[role]/skills/[skill]
```

═══════════════════════════════════════════════════════════════════════════════
              10. ROLE SYNONYMS (COMPREHENSIVE)
═══════════════════════════════════════════════════════════════════════════════

## 10.1 Engineering Roles
```typescript
const ENGINEERING_SYNONYMS = {
  'software-engineer': ['swe', 'developer', 'programmer', 'coder', 'engineer'],
  'frontend-engineer': ['frontend', 'front-end', 'ui engineer', 'react developer'],
  'backend-engineer': ['backend', 'back-end', 'server engineer', 'api engineer'],
  'full-stack-engineer': ['fullstack', 'full-stack', 'full stack developer'],
  'devops-engineer': ['devops', 'sre', 'site reliability', 'platform engineer'],
  'data-engineer': ['data engineering', 'etl engineer', 'analytics engineer'],
  'machine-learning-engineer': ['ml engineer', 'mle', 'ai engineer'],
}
```

## 10.2 Product & Design Roles
```typescript
const PRODUCT_SYNONYMS = {
  'product-manager': ['pm', 'product', 'product owner'],
  'product-designer': ['designer', 'ux designer', 'ui designer'],
  'ux-researcher': ['user researcher', 'design researcher'],
}
```

## 10.3 Data & Analytics Roles
```typescript
const DATA_SYNONYMS = {
  'data-scientist': ['ds', 'data science', 'ml scientist'],
  'data-analyst': ['analyst', 'business analyst', 'bi analyst'],
}
```

## 10.4 Business Roles
```typescript
const BUSINESS_SYNONYMS = {
  'sales-engineer': ['se', 'solutions engineer', 'pre-sales'],
  'account-executive': ['ae', 'sales rep', 'account manager'],
  'marketing-manager': ['marketer', 'growth marketing'],
}
```

═══════════════════════════════════════════════════════════════════════════════
          11. DEPLOYMENT & SERVER RULES (RAILWAY)
═══════════════════════════════════════════════════════════════════════════════

## 11.1 Production Environment (Railway)
- **Platform**: Railway.app (Free Trial → Hobby $5/mo)
- **Production URL**: https://www.6figjobs.com
- **Staging URL**: https://staging.6figjobs.com (if configured)
- **Database**: Railway PostgreSQL or external (Neon/Supabase)
- **Deployment**: Auto-deploy on git push to `main` branch
- **Dashboard**: https://railway.app/dashboard

## 11.2 Railway Plan Comparison
| Feature | Free Trial | Hobby ($5/mo) | Pro ($20/mo) |
|---------|------------|---------------|--------------|
| Execution Hours | 500/mo | Unlimited | Unlimited |
| Memory | 512MB | 8GB | 32GB |
| vCPU | Shared | 8 vCPU | 32 vCPU |
| Deployments | Unlimited | Unlimited | Unlimited |
| Custom Domains | ✅ | ✅ | ✅ |

## 11.3 Railway Environment Variables
```bash
# Required
DATABASE_URL=postgresql://...
NEXT_PUBLIC_SITE_URL=https://www.6figjobs.com

# Optional
NODE_ENV=production
```

## 11.4 Deployment Workflow (Railway)
```bash
# Step 1: Local development
git add . && git commit -m "feat: description"

# Step 2: Push to deploy (auto-deploys)
git push origin main

# Step 3: Monitor deployment
# Check Railway dashboard for build logs

# Step 4: Verify production
curl -I https://www.6figjobs.com
```

## 11.5 Railway CLI Commands
```bash
# Install CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# View logs
railway logs

# Run commands in production
railway run npx prisma migrate deploy
```

## 11.6 Database Migrations (Railway)
```bash
# Option 1: Railway CLI
railway run npx prisma migrate deploy

# Option 2: Add to build command in Railway
# Build Command: npx prisma migrate deploy && npm run build
```

## 11.4 Git Commit Message Format
```bash
git commit -m "feat(seo): description

- Bullet point 1
- Bullet point 2

See docs/SEO-IMPLEMENTATION-v1.5.md for details"
```

═══════════════════════════════════════════════════════════════════════════════
                    12. NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════════════════════

## 12.1 Absolute Rules (NEVER VIOLATE)

❌ **NEVER:**
1. Display jobs below LOCAL high-salary threshold
2. Convert salaries between currencies
3. Include entry-level, junior, or intern positions
4. Output partial/incomplete code
5. Skip structured data (JSON-LD)
6. Use generic meta descriptions
7. Create pages with <5 jobs
8. Make URLs longer than 75 characters
9. Skip FAQ schema on listing pages
10. Deploy without testing on staging first

✅ **ALWAYS:**
1. Filter jobs by LOCAL salary threshold (PPP-adjusted)
2. Display salary in ORIGINAL currency only
3. Include brand + count + $100k in titles
4. Add FAQ schema to all listing pages
5. Use long-tail keywords in first paragraph
6. Include BreadcrumbList on all pages
7. Test on staging before production
8. Monitor Google Search Console

═══════════════════════════════════════════════════════════════════════════════
                     13. IMPLEMENTATION CHECKLIST
═══════════════════════════════════════════════════════════════════════════════

## 13.1 Completed ✅

- [x] State pages (50 states)
- [x] Skills pages (30 skills)
- [x] Industry pages (10 industries)
- [x] City pages (19 cities)
- [x] Role + Remote combos
- [x] Role + City combos
- [x] Role + Skill combos
- [x] Skill + Remote combos
- [x] metadataBase configuration
- [x] Security headers
- [x] Staging noindex/robots block
- [x] AI crawler rules
- [x] llms.txt
- [x] Viewport export
- [x] Legacy head.tsx removal
- [x] ItemList + Breadcrumb + FAQ on listings
- [x] Occupation + FAQ on salary guides
- [x] Footer with $100k sections
- [x] Sitemaps expanded

## 13.2 Remaining (10%)

- [ ] Salary percentile tables (P25/Median/P75/P90)
- [ ] Monthly salary equivalents
- [ ] "Last updated" on salary guides
- [ ] WebSite schema on homepage
- [ ] Organization schema on homepage
- [ ] Deeper combo coverage (more roles × cities)
- [ ] Company pages metadata polish

═══════════════════════════════════════════════════════════════════════════════
                     14. HOMEPAGE UI/UX — MODERN & SLEEK (ENHANCED v2.4)
═══════════════════════════════════════════════════════════════════════════════

## 14.1 Design Philosophy

**Goal:** Premium, modern, dark-mode-first design that conveys trust and high-quality.
**Inspiration:** Linear.app, Vercel, Raycast — clean, minimal, high-contrast.
**Target Users:** Senior engineers, managers, directors making $100k+ decisions.

### Design Principles
1. **Content-First**: Let jobs speak for themselves, minimal chrome
2. **Salary-Forward**: Green salary badges should pop immediately
3. **Trust Signals**: Company logos, job counts, "verified" badges
4. **Performance**: Sub-2s load time, instant interactions
5. **Accessibility**: WCAG 2.1 AA compliant, keyboard navigable

## 14.2 Hero Section

### Current Issues to Fix:
- ❌ Generic copy that doesn't differentiate
- ❌ Lacks social proof
- ❌ Missing urgency/FOMO elements
- ❌ Search not prominent enough
- ❌ No live job count or "new today" indicator

### Improved Hero Structure:
```tsx
<section className="hero bg-gradient-to-b from-slate-950 to-slate-900">
  {/* Announcement Banner - Creates urgency */}
  <div className="announcement-pill bg-green-500/10 border border-green-500/20 
                  text-green-400 px-4 py-1.5 rounded-full text-sm">
    🚀 <span className="font-semibold">2,847</span> new $100k+ jobs this week
    <span className="text-green-500/60 ml-2">• Updated 2 min ago</span>
  </div>
  
  {/* Main H1 — Clear Value Prop with SEO Keywords */}
  <h1 className="text-5xl md:text-6xl font-bold mt-8 tracking-tight">
    Land Your <span className="bg-gradient-to-r from-green-400 to-emerald-500 
                               bg-clip-text text-transparent">$100k+ Job</span>
  </h1>
  
  {/* Subhead — Differentiation + Trust */}
  <p className="text-xl text-slate-400 mt-4 max-w-2xl mx-auto">
    The only job board <span className="text-white">exclusively</span> for 
    six-figure positions. No entry-level. No recruiters. Just 
    <span className="text-green-400"> high-paying roles</span> from verified companies.
  </p>
  
  {/* Search — Prominent, Autocomplete */}
  <div className="mt-8 max-w-2xl mx-auto">
    <SearchInput 
      placeholder="Search 13,299 high-paying jobs..."
      className="w-full h-14 text-lg"
      icon={<SearchIcon className="text-slate-500" />}
      suggestions={['Software Engineer', 'Product Manager', 'Data Scientist']}
    />
  </div>
  
  {/* Quick Filters — Popular Searches */}
  <div className="flex flex-wrap justify-center gap-2 mt-6">
    <QuickFilter href="/jobs/software-engineer" count={3240}>
      Software Engineer
    </QuickFilter>
    <QuickFilter href="/jobs/product-manager" count={890}>
      Product Manager
    </QuickFilter>
    <QuickFilter href="/remote" count={8450}>
      🌍 Remote
    </QuickFilter>
    <QuickFilter href="/jobs/200k-plus" count={2100} highlight>
      💰 $200k+
    </QuickFilter>
  </div>
  
  {/* Social Proof — Company Logos */}
  <div className="mt-12 pt-8 border-t border-slate-800">
    <p className="text-sm text-slate-500 mb-4">
      Hiring from 2,600+ top companies
    </p>
    <div className="flex flex-wrap justify-center gap-8 items-center 
                    opacity-60 hover:opacity-100 transition-opacity">
      <CompanyLogo name="Google" />
      <CompanyLogo name="Stripe" />
      <CompanyLogo name="Anthropic" />
      <CompanyLogo name="OpenAI" />
      <CompanyLogo name="Vercel" />
      <CompanyLogo name="Notion" />
    </div>
  </div>
</section>
```

## 14.3 Hero Copy Variations (A/B Test Ready)

### Version A: Direct & Bold (Default)
```tsx
H1: "Land Your $100k+ Job"
Sub: "The only job board exclusively for six-figure positions."
CTA: "Browse 13,000+ Jobs"
```

### Version B: Outcome-Focused
```tsx
H1: "Find Jobs That Pay What You're Worth"
Sub: "13,000+ verified $100k-$500k positions. Updated daily."
CTA: "Search High-Paying Jobs"
```

### Version C: Exclusivity
```tsx
H1: "Six Figure Jobs Only"
Sub: "We reject 90% of listings. Only the highest-paying make it here."
CTA: "See Today's Top Jobs"
```

### Version D: Data-Driven
```tsx
H1: "13,299 Jobs Paying $100k+"
Sub: "Average salary: $185k. New jobs every hour. Real salaries, not guesses."
CTA: "Start Browsing"
```

## 14.4 Visual Design System (Complete)

### Color Palette (Dark Mode First)
```css
:root {
  /* Backgrounds */
  --bg-primary: #09090b;       /* zinc-950 - page background */
  --bg-secondary: #18181b;     /* zinc-900 - card backgrounds */
  --bg-tertiary: #27272a;      /* zinc-800 - hover states */
  --bg-elevated: #3f3f46;      /* zinc-700 - active/selected */
  
  /* Text */
  --text-primary: #fafafa;     /* zinc-50 - headings */
  --text-secondary: #a1a1aa;   /* zinc-400 - body text */
  --text-muted: #71717a;       /* zinc-500 - labels */
  
  /* Accent Colors */
  --accent-green: #22c55e;     /* green-500 - salary, success */
  --accent-green-muted: #16a34a; /* green-600 - hover */
  --accent-blue: #3b82f6;      /* blue-500 - links */
  --accent-purple: #a855f7;    /* purple-500 - featured */
  
  /* Borders */
  --border: #27272a;           /* zinc-800 */
  --border-light: #3f3f46;     /* zinc-700 */
  
  /* Status */
  --status-new: #22c55e;       /* green - new jobs */
  --status-hot: #f97316;       /* orange - trending */
  --status-remote: #3b82f6;    /* blue - remote */
}
```

### Typography System
```css
:root {
  /* Font Families */
  --font-display: 'Inter', -apple-system, sans-serif;
  --font-body: 'Inter', -apple-system, sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;
  
  /* Font Sizes */
  --text-xs: 0.75rem;    /* 12px - labels, meta */
  --text-sm: 0.875rem;   /* 14px - secondary text */
  --text-base: 1rem;     /* 16px - body */
  --text-lg: 1.125rem;   /* 18px - emphasized */
  --text-xl: 1.25rem;    /* 20px - card titles */
  --text-2xl: 1.5rem;    /* 24px - section headers */
  --text-3xl: 1.875rem;  /* 30px - page headers */
  --text-4xl: 2.25rem;   /* 36px - hero sub */
  --text-5xl: 3rem;      /* 48px - hero main */
  --text-6xl: 3.75rem;   /* 60px - hero main (desktop) */
}
```

### Spacing Scale
```css
:root {
  --space-1: 0.25rem;   /* 4px */
  --space-2: 0.5rem;    /* 8px */
  --space-3: 0.75rem;   /* 12px */
  --space-4: 1rem;      /* 16px */
  --space-5: 1.25rem;   /* 20px */
  --space-6: 1.5rem;    /* 24px */
  --space-8: 2rem;      /* 32px */
  --space-10: 2.5rem;   /* 40px */
  --space-12: 3rem;     /* 48px */
  --space-16: 4rem;     /* 64px */
}
```

### Component Styles

#### Buttons
```tsx
// Primary Button (Green)
<button className="bg-green-500 hover:bg-green-600 text-white 
                   px-6 py-2.5 rounded-lg font-medium
                   transition-colors duration-150">
  Browse Jobs
</button>

// Secondary Button (Outline)
<button className="border border-zinc-700 hover:border-zinc-600 
                   text-white px-6 py-2.5 rounded-lg font-medium
                   hover:bg-zinc-800 transition-colors">
  View Company
</button>

// Ghost Button
<button className="text-zinc-400 hover:text-white 
                   hover:bg-zinc-800 px-4 py-2 rounded-lg
                   transition-colors">
  Learn More
</button>
```

#### Cards
```tsx
// Job Card (Hover Effect)
<article className="group bg-zinc-900 border border-zinc-800 
                    rounded-xl p-5 hover:border-zinc-700 
                    hover:bg-zinc-800/50 transition-all duration-200
                    cursor-pointer">
  {/* Content */}
</article>

// Featured Job Card (Green Accent)
<article className="group bg-zinc-900 border border-green-500/30 
                    rounded-xl p-5 hover:border-green-500/50
                    ring-1 ring-green-500/10">
  <span className="absolute -top-2 -right-2 bg-green-500 text-white 
                   text-xs px-2 py-0.5 rounded-full">
    Featured
  </span>
  {/* Content */}
</article>
```

#### Tags/Pills
```tsx
// Skill Tag
<span className="bg-zinc-800 text-zinc-300 px-2.5 py-1 
                 rounded-md text-sm">
  React
</span>

// Remote Badge
<span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 
                 px-2.5 py-1 rounded-full text-sm">
  🌍 Remote
</span>

// Salary Badge (Prominent)
<span className="bg-green-500/10 text-green-400 border border-green-500/20 
                 px-3 py-1.5 rounded-lg font-mono font-semibold">
  $180k - $250k
</span>
```

## 14.5 Job Card Design (Detailed)

```tsx
// components/JobCard.tsx
interface JobCardProps {
  job: Job;
  featured?: boolean;
}

export function JobCard({ job, featured }: JobCardProps) {
  return (
    <article className={cn(
      "group relative bg-zinc-900 border rounded-xl p-5",
      "hover:bg-zinc-800/50 transition-all duration-200 cursor-pointer",
      featured 
        ? "border-green-500/30 ring-1 ring-green-500/10" 
        : "border-zinc-800 hover:border-zinc-700"
    )}>
      {/* Featured Badge */}
      {featured && (
        <span className="absolute -top-2 -right-2 bg-green-500 text-white 
                         text-xs px-2 py-0.5 rounded-full font-medium">
          Featured
        </span>
      )}
      
      {/* Header: Logo + Company + Title */}
      <div className="flex gap-4">
        <img 
          src={job.company.logo || `/api/placeholder/${job.company.name}`}
          alt={job.company.name}
          className="w-12 h-12 rounded-lg bg-zinc-800 object-contain"
        />
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-white truncate 
                         group-hover:text-green-400 transition-colors">
            {job.title}
          </h3>
          <p className="text-sm text-zinc-400 truncate">
            {job.company.name}
          </p>
        </div>
      </div>
      
      {/* Salary — Most Prominent Element */}
      <div className="mt-4">
        <span className="inline-flex items-center bg-green-500/10 
                         text-green-400 border border-green-500/20 
                         px-3 py-1.5 rounded-lg font-mono font-semibold text-lg">
          {formatSalary(job.salaryMin, job.salaryMax, job.currency)}
        </span>
      </div>
      
      {/* Tags Row */}
      <div className="flex flex-wrap gap-2 mt-4">
        {job.remote && (
          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/20 
                           px-2 py-0.5 rounded-full text-xs">
            🌍 Remote
          </span>
        )}
        {job.level && (
          <span className="bg-zinc-800 text-zinc-300 px-2 py-0.5 
                           rounded-md text-xs">
            {job.level}
          </span>
        )}
        {job.skills?.slice(0, 3).map(skill => (
          <span key={skill} className="bg-zinc-800 text-zinc-400 
                                        px-2 py-0.5 rounded-md text-xs">
            {skill}
          </span>
        ))}
      </div>
      
      {/* Footer: Location + Posted Time */}
      <div className="flex items-center gap-2 mt-4 text-xs text-zinc-500">
        <MapPinIcon className="w-3.5 h-3.5" />
        <span>{job.location}</span>
        <span className="text-zinc-600">•</span>
        <ClockIcon className="w-3.5 h-3.5" />
        <span>{formatRelativeTime(job.postedAt)}</span>
        {daysSince(job.postedAt) <= 1 && (
          <span className="text-green-400 font-medium">NEW</span>
        )}
      </div>
    </article>
  );
}
```

## 14.6 Stats Bar Component

```tsx
// components/StatsBar.tsx
export function StatsBar() {
  return (
    <div className="flex flex-wrap justify-center gap-8 md:gap-16 
                    py-8 border-y border-zinc-800">
      <Stat value="13,299" label="$100k+ Jobs" trend="+847 this week" />
      <Stat value="2,600+" label="Companies" />
      <Stat value="$185k" label="Avg. Salary" />
      <Stat value="94%" label="Have Salary" highlight />
    </div>
  );
}

function Stat({ value, label, trend, highlight }: StatProps) {
  return (
    <div className="text-center">
      <div className={cn(
        "text-3xl font-bold",
        highlight ? "text-green-400" : "text-white"
      )}>
        {value}
      </div>
      <div className="text-sm text-zinc-500 mt-1">{label}</div>
      {trend && (
        <div className="text-xs text-green-400 mt-1">↑ {trend}</div>
      )}
    </div>
  );
}
```

## 14.7 Homepage Sections (Priority Order)

1. **Hero** — H1, search, quick filters, social proof
2. **Stats Bar** — Live job counts, companies, avg salary  
3. **Featured Jobs** — 6-8 top jobs with salary prominent (carousel on mobile)
4. **Browse by Salary** — $100k, $150k, $200k, $300k+ tiers with counts
5. **Browse by Role** — Top 10 roles with job counts (Software Engineer, PM, etc.)
6. **Browse by Location** — Top 10 cities + Remote with counts
7. **Top Companies** — Logo grid (12-16 logos) with "View all 2,600 companies"
8. **Why Six Figure Jobs** — 4 USP cards with icons
9. **Recent Jobs** — Latest 6 jobs with "View all" link
10. **FAQ** — 5-7 questions with Schema markup
11. **Newsletter CTA** — "Get $100k+ jobs in your inbox"
12. **Footer** — All pSEO links organized by category

## 14.8 USP Section (Why Choose Us)

```tsx
<section className="py-16">
  <h2 className="text-2xl font-bold text-center mb-12">
    Why Six Figure Jobs?
  </h2>
  
  <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
    <USPCard 
      icon={<DollarSignIcon className="w-8 h-8 text-green-400" />}
      title="$100k+ Only"
      description="Every job pays six figures. We reject anything below threshold."
    />
    <USPCard 
      icon={<CheckCircleIcon className="w-8 h-8 text-green-400" />}
      title="Verified Salaries"
      description="Real salary ranges from company ATS. No guessing games."
    />
    <USPCard 
      icon={<ClockIcon className="w-8 h-8 text-green-400" />}
      title="Updated Hourly"
      description="Fresh jobs every hour. Stale listings automatically removed."
    />
    <USPCard 
      icon={<BuildingIcon className="w-8 h-8 text-green-400" />}
      title="Top Companies"
      description="2,600+ companies including Google, Stripe, OpenAI, and more."
    />
  </div>
</section>
```

## 14.9 Mobile Responsiveness

### Breakpoints
```css
/* Tailwind default breakpoints */
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
2xl: 1536px /* Extra large */
```

### Mobile-First Considerations
```tsx
// Job cards: Stack vertically on mobile
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">

// Hero: Smaller text on mobile
<h1 className="text-3xl md:text-5xl lg:text-6xl">

// Filters: Horizontal scroll on mobile
<div className="flex overflow-x-auto md:flex-wrap gap-2 -mx-4 px-4 md:mx-0">

// Stats: 2x2 grid on mobile, row on desktop
<div className="grid grid-cols-2 md:flex md:justify-center gap-4 md:gap-16">

// Sidebar filters: Slide-in drawer on mobile
<Sheet>
  <SheetTrigger className="md:hidden">
    <FilterIcon /> Filters
  </SheetTrigger>
  <SheetContent side="left">
    <FilterSidebar />
  </SheetContent>
</Sheet>
```

## 14.10 Accessibility Requirements

### WCAG 2.1 AA Compliance
```tsx
// Color contrast: 4.5:1 minimum for text
// Our zinc-400 (#a1a1aa) on zinc-900 (#18181b) = 7.2:1 ✅

// Focus states: Visible ring
<button className="focus:outline-none focus:ring-2 focus:ring-green-500 
                   focus:ring-offset-2 focus:ring-offset-zinc-900">

// Keyboard navigation: All interactive elements focusable
<a href="#main-content" className="sr-only focus:not-sr-only">
  Skip to main content
</a>

// Screen reader labels
<button aria-label="Search for jobs">
  <SearchIcon aria-hidden="true" />
</button>

// Form labels
<label htmlFor="search" className="sr-only">Search jobs</label>
<input id="search" name="search" />

// Semantic HTML
<main id="main-content">
  <article role="listitem">
    <h3>Job Title</h3>
  </article>
</main>
```

### Reduced Motion
```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
``` 
    icon={<Zap />}
    title="Direct Apply"
    description="No recruiters. Apply straight to the company."
  />
</section>
```

## 14.9 Mobile-First Responsive

### Breakpoints
```css
sm: 640px   /* Mobile landscape */
md: 768px   /* Tablet */
lg: 1024px  /* Desktop */
xl: 1280px  /* Large desktop */
```

### Mobile Priorities
- Search always visible and tappable
- Job cards stack vertically
- Salary is largest text on card
- Sticky filter bar on scroll
- Bottom nav for key actions

## 14.10 Performance Targets

| Metric | Target | Current |
|--------|--------|---------|
| LCP | < 2.5s | Check |
| FID | < 100ms | Check |
| CLS | < 0.1 | Check |
| Lighthouse | > 90 | Check |

### Optimization Checklist
- [ ] Lazy load images below fold
- [ ] Preload hero fonts
- [ ] Use next/image for all images
- [ ] Minimize JavaScript bundle
- [ ] Enable static generation where possible
═══════════════════════════════════════════════════════════════════════════════

**pSEO Routes:**
```
/jobs/state/[state]           → 50 state pages
/jobs/skills/[skill]          → 30 skill pages
/jobs/industry/[industry]     → 10 industry pages
/jobs/city/[city]             → 19 city pages
/jobs/[role]/remote           → role + remote combos
/jobs/[role]/[city]           → role + city combos
/jobs/[role]/skills/[skill]   → role + skill combos
/jobs/skills/[skill]/remote   → skill + remote combos
```

**H1 Patterns:**
```
Role:     "[COUNT] $100k+ [Role] Jobs"
State:    "[COUNT] $100k+ Jobs in [State]"
City:     "[COUNT] $100k+ Jobs in [City]"
Skill:    "[COUNT] $100k+ [Skill] Jobs"
Combo:    "[COUNT] Remote [Role] $100k+ Jobs"
Salary:   "$100k+ [Role] Salaries in [Location]"
```

**Required Schemas:**
```
Listings: ItemList + BreadcrumbList + FAQPage
Details:  JobPosting + BreadcrumbList
Company:  Organization + ItemList
Salary:   Occupation + FAQPage + BreadcrumbList
```

**Keyword Density:**
```
"$100k": 5-7 per 500 words
"high paying": 3-4 per 500 words
"six figure": 2-3 per 500 words
```

═══════════════════════════════════════════════════════════════════════════════
              16. COMPETITOR FEATURE ANALYSIS & ROADMAP
═══════════════════════════════════════════════════════════════════════════════

## 16.1 Competitor Overview

| Competitor | Focus | Strengths | Our Advantage |
|------------|-------|-----------|---------------|
| RemoteRocketship | Remote jobs | 38k+ jobs, advanced filters, AI apply | $100k+ exclusive focus |
| Wellfound | Startups | Equity/funding data, 1-click apply | Salary transparency |
| Himalayas | Remote | Beautiful UX, company profiles | High-salary curation |
| Levels.fyi | Salaries | Crowdsourced comp data, leveling | Job listings + salary |

## 16.2 Features to Steal/Implement

### 🔥 HIGH PRIORITY (Week 1-2)

#### 1. Salary Calculator / Estimator
**From:** Wellfound, Levels.fyi
```
/salary-calculator
- Input: Role, Location, Experience Level
- Output: Estimated range with percentiles
- Show: P25, Median, P75, P90
- Compare: How our jobs compare to market
```

#### 2. Company Funding & Size Data
**From:** Wellfound, Himalayas
```tsx
// Add to Company model & pages
{
  fundingStage: 'Series B',      // Seed, A, B, C, D, Public
  totalFunding: '$50M',
  employeeCount: '51-200',
  foundedYear: 2019,
  investors: ['a16z', 'Sequoia'],
  lastFundingDate: '2024-03'
}
```

#### 3. Tech Stack Display
**From:** Himalayas, Wellfound
```tsx
// Show on job cards and company pages
<TechStack>
  <Tag>React</Tag>
  <Tag>TypeScript</Tag>
  <Tag>AWS</Tag>
  <Tag>PostgreSQL</Tag>
</TechStack>
```

#### 4. Time-to-Fill / Hiring Velocity
**From:** RemoteRocketship
```
"Average time to fill: 41 days"
"87 jobs closed this month"
"Hiring trend: 📈 Up 15%"
```

### 🎯 MEDIUM PRIORITY (Week 3-4)

#### 5. Benefits & Perks Display
**From:** Himalayas, Wellfound
```tsx
// Add to Job model & cards
benefits: [
  '🏥 Health Insurance',
  '📈 Equity/Stock Options',
  '🏖️ Unlimited PTO',
  '💻 Remote Work',
  '📚 Learning Budget',
  '🏋️ Gym Membership'
]
```

#### 6. Visa Sponsorship Filter
**From:** RemoteRocketship
```
/jobs?visa=true
/jobs/visa-sponsorship

Filter: "Visa Sponsorship Available"
```

#### 7. Timezone-Based Filtering
**From:** Himalayas
```
/jobs?timezone=US-Pacific
/jobs?timezone=EU

Filter: "Timezone overlap with..."
```

#### 8. Email Job Alerts (Weekly Digest)
**From:** All competitors
```
- Daily/Weekly digest emails
- Personalized by role/location/salary
- "X new $100k+ jobs this week"
- One-click apply from email
```

### 📈 LOWER PRIORITY (Month 2)

#### 9. One-Click Apply
**From:** Wellfound
```tsx
// Save profile once, apply with one click
<Button onClick={oneClickApply}>
  ⚡ Apply Instantly
</Button>
```

#### 10. Application Tracker
**From:** Himalayas
```
/dashboard
- Track applied jobs
- Status: Applied → Interview → Offer
- Reminders for follow-ups
```

#### 11. AI Resume Builder
**From:** Himalayas
```
/tools/resume-builder
- AI-generated resume
- Tailored to job description
- ATS-optimized
```

#### 12. Salary Negotiation Tips
**From:** Levels.fyi
```
/resources/salary-negotiation
- How to negotiate $10k+ more
- Scripts and templates
- Industry benchmarks
```

## 16.3 Unique Features (Our Differentiation)

### ✅ Already Implemented
- $100k+ exclusive focus (no one else does this)
- PPP-adjusted local salary thresholds
- Verified salary transparency on every job
- 400+ pSEO pages for long-tail SEO
- Salary tier pages ($100k, $200k, $300k, $400k)

### 🆕 New Unique Features to Build

#### 1. "Why $100k+ at [Company]?" Section
```tsx
// On job detail pages
<section>
  <h2>Why [Company] Pays $100k+</h2>
  <ul>
    <li>Series C startup with $80M raised</li>
    <li>Competing for top talent in SF</li>
    <li>Engineering-led culture</li>
    <li>Premium product with high margins</li>
  </ul>
</section>
```

#### 2. Salary Trajectory Visualization
```tsx
// Show career progression
Junior ($80k) → Mid ($120k) → Senior ($180k) → Staff ($250k) → Principal ($350k)
```

#### 3. "Jobs Expiring Soon" Section
```tsx
// Create urgency
<section>
  <h2>🔥 Closing This Week</h2>
  {jobsExpiringIn7Days.map(job => ...)}
</section>
```

#### 4. Company Salary Leaderboard
```
/companies/top-paying
1. Jane Street - Avg $400k
2. Two Sigma - Avg $380k
3. Citadel - Avg $375k
...
```

#### 5. "Hidden Gems" Section
```tsx
// Lesser-known companies paying well
<section>
  <h2>🏆 Hidden Gem Companies</h2>
  <p>Top-paying companies you haven't heard of</p>
  {hiddenGems.map(company => ...)}
</section>
```

## 16.4 Advanced Filters to Add

| Filter | From | Priority |
|--------|------|----------|
| Visa Sponsorship | RemoteRocketship | 🔥 High |
| Timezone | Himalayas | 🔥 High |
| Company Size | Wellfound | 🔥 High |
| Funding Stage | Wellfound | 🎯 Medium |
| Tech Stack | Himalayas | 🎯 Medium |
| Benefits | Himalayas | 🎯 Medium |
| Interview Process | Levels.fyi | 📈 Low |
| Work Style (Async) | RemoteRocketship | 📈 Low |

## 16.5 Content Marketing Ideas

### From Levels.fyi
- [ ] Annual Salary Report (2025)
- [ ] Top Paying Companies by Role
- [ ] Salary Trends by Location
- [ ] Compensation Heatmaps

### From Himalayas
- [ ] Remote Work Guides
- [ ] Interview Question Database
- [ ] Resume/Cover Letter Templates
- [ ] Career Path Guides

### From Wellfound
- [ ] Startup Industry Reports
- [ ] "10 Startups to Watch in 2025"
- [ ] Equity Compensation Guide

## 16.6 Implementation Checklist

### Phase 1: Quick Wins (Week 1-2)
- [ ] Add company size to job cards
- [ ] Add tech stack tags
- [ ] Add benefits icons
- [ ] Add "Posted X days ago" to cards
- [ ] Add visa sponsorship filter
- [ ] Add timezone filter

### Phase 2: Data Enrichment (Week 3-4)
- [ ] Scrape/add funding data for companies
- [ ] Add employee count ranges
- [ ] Calculate and show avg time-to-fill
- [ ] Build salary calculator page

### Phase 3: User Features (Month 2)
- [ ] Email job alerts
- [ ] Job application tracker
- [ ] Saved jobs / favorites
- [ ] User profiles

### Phase 4: Content (Month 2-3)
- [ ] Salary negotiation guide
- [ ] Interview question database
- [ ] 2025 Salary Report
- [ ] Top Paying Companies page

═══════════════════════════════════════════════════════════════════════════════
      18. SCRAPER OPTIMIZATION & JOB MAXIMIZATION (NEW IN v2.4)
═══════════════════════════════════════════════════════════════════════════════

## 18.1 ATS Integration Overview

**Current ATS Integrations:**

| ATS Provider | API Type | Rate Limit | Est. Jobs | Status |
|--------------|----------|------------|-----------|--------|
| Greenhouse | REST API | 50 req/10s | 5,000+ | ✅ Active |
| Lever | REST API | 50 req/min | 3,000+ | ✅ Active |
| Ashby | REST API | 100 req/min | 2,000+ | ✅ Active |
| Workday | Scraping | N/A | 2,500+ | 🔄 Planned |
| iCIMS | Scraping | N/A | 1,500+ | 🔄 Planned |
| Jobvite | Scraping | N/A | 1,000+ | 🔄 Planned |
| SmartRecruiters | REST API | Varies | 800+ | 🔄 Planned |
| BreezyHR | REST API | Varies | 500+ | 🔄 Planned |

**Target:** 25,000+ high-quality $100k+ jobs from 5,000+ companies

## 18.2 Greenhouse Scraper Optimization

### API Endpoints Used
```typescript
// Job Board API (Public) - No auth required
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs/{job_id}
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/departments
GET https://boards-api.greenhouse.io/v1/boards/{board_token}/offices
```

### Optimal Scraping Strategy
```typescript
// scraper/greenhouse.ts
interface GreenhouseConfig {
  batchSize: 50,           // Jobs per request (max 100)
  delayBetweenBatches: 200, // ms between requests
  retryAttempts: 3,
  retryDelay: 1000,        // ms
  timeout: 30000,          // 30s timeout
}

// Fetch all jobs for a company
async function scrapeGreenhouseCompany(boardToken: string) {
  const url = `https://boards-api.greenhouse.io/v1/boards/${boardToken}/jobs?content=true`;
  const response = await fetch(url, { 
    headers: { 'User-Agent': 'SixFigJobs/1.0 (+https://www.6figjobs.com)' }
  });
  const data = await response.json();
  return data.jobs.filter(job => meetsHighSalaryThreshold(job));
}
```

### Salary Extraction from Greenhouse
```typescript
// Greenhouse salary can be in multiple places:
// 1. job.pay_input_ranges[0].min_cents / max_cents (BEST - structured)
// 2. job.metadata (custom fields)
// 3. job.content (parse from description)

function extractGreenhouseSalary(job: GreenhouseJob): SalaryRange | null {
  // Priority 1: Structured pay ranges (most reliable)
  if (job.pay_input_ranges?.length > 0) {
    const range = job.pay_input_ranges[0];
    return {
      min: range.min_cents / 100,  // CRITICAL: Convert from cents!
      max: range.max_cents / 100,
      currency: range.currency || 'USD',
      period: range.interval || 'yearly'
    };
  }
  
  // Priority 2: Parse from description
  return parsesSalaryFromText(job.content);
}

// CRITICAL BUG FIX: Ashby/Greenhouse cents conversion
// Some APIs return salary in CENTS, not dollars!
// $150,000 comes as 15000000 (150000 * 100)
// Always check if value > 1,000,000 → divide by 100
```

### High-Salary Filtering
```typescript
function meetsHighSalaryThreshold(job: any, country: string = 'US'): boolean {
  const salary = extractSalary(job);
  if (!salary) return false;
  
  const thresholds = {
    'US': 100000,
    'CA': 100000,  // CAD
    'UK': 75000,   // GBP
    'DE': 80000,   // EUR
    'AU': 140000,  // AUD
    'CH': 110000,  // CHF
    'SG': 120000,  // SGD
  };
  
  const threshold = thresholds[country] || 100000;
  
  // Use MAX salary for threshold check (be inclusive)
  return salary.max >= threshold || salary.min >= threshold * 0.9;
}
```

## 18.3 Lever Scraper Optimization

### API Endpoints
```typescript
// Lever Postings API (Public)
GET https://api.lever.co/v0/postings/{company_slug}
GET https://api.lever.co/v0/postings/{company_slug}?mode=json
GET https://api.lever.co/v0/postings/{company_slug}/{posting_id}
```

### Optimal Strategy
```typescript
interface LeverConfig {
  batchSize: 100,          // All jobs at once (no pagination needed)
  delayBetweenCompanies: 500, // ms between companies
  includeContent: true,
}

async function scrapeLeverCompany(companySlug: string) {
  const url = `https://api.lever.co/v0/postings/${companySlug}?mode=json`;
  const response = await fetch(url);
  const jobs = await response.json();
  
  return jobs
    .filter(job => !isEntryLevel(job.text))
    .filter(job => meetsHighSalaryThreshold(job))
    .map(job => transformLeverJob(job));
}
```

### Salary Extraction from Lever
```typescript
// Lever salary locations:
// 1. job.salaryRange.min / max (structured - rare)
// 2. job.categories.commitment (sometimes has salary)
// 3. job.text (description - most common)
// 4. job.additional (custom text field)

function extractLeverSalary(job: LeverJob): SalaryRange | null {
  // Check structured field first
  if (job.salaryRange?.min) {
    return {
      min: job.salaryRange.min,
      max: job.salaryRange.max,
      currency: job.salaryRange.currency || 'USD',
      period: 'yearly'
    };
  }
  
  // Parse from description (most common)
  return parseSalaryFromText(job.text);
}
```

## 18.4 Ashby Scraper Optimization

### API Endpoints
```typescript
// Ashby Job Board API
GET https://api.ashbyhq.com/posting-api/job-board/{board_slug}
GET https://jobs.ashbyhq.com/{company_slug}?format=json
```

### Critical Ashby Bugs to Avoid
```typescript
// ⚠️ ASHBY SALARY BUG: Values may be in CENTS!
// Job shows "$150,000" but API returns 15000000
// ALWAYS check if salary > 1,000,000 and divide by 100

function sanitizeAshbySalary(value: number): number {
  // If value looks like cents (> $1M is unlikely for most jobs)
  if (value > 1000000) {
    return value / 100;
  }
  return value;
}

// Correct salary extraction
function extractAshbySalary(job: AshbyJob): SalaryRange | null {
  if (job.compensation?.salaryRange) {
    const range = job.compensation.salaryRange;
    return {
      min: sanitizeAshbySalary(range.min),
      max: sanitizeAshbySalary(range.max),
      currency: range.currency || 'USD',
      period: range.interval || 'yearly'
    };
  }
  return parseSalaryFromText(job.description);
}
```

## 18.5 Universal Salary Parser

```typescript
// lib/salary-parser.ts - Universal salary extraction from text

const SALARY_PATTERNS = [
  // "$150,000 - $200,000" or "$150k - $200k"
  /\$\s*([\d,]+)k?\s*[-–to]+\s*\$?\s*([\d,]+)k?(?:\s*\/?\s*(?:year|yr|annually|per\s*year))?/gi,
  
  // "$150,000+" or "$150k+"
  /\$\s*([\d,]+)k?\s*\+(?:\s*\/?\s*(?:year|yr|annually))?/gi,
  
  // "150,000 USD" or "150k USD"
  /([\d,]+)k?\s*(?:USD|CAD|GBP|EUR|AUD|CHF|SGD)/gi,
  
  // "£75,000 - £100,000" (GBP)
  /£\s*([\d,]+)k?\s*[-–to]+\s*£?\s*([\d,]+)k?/gi,
  
  // "€80,000 - €120,000" (EUR)
  /€\s*([\d,]+)k?\s*[-–to]+\s*€?\s*([\d,]+)k?/gi,
  
  // Base salary patterns
  /base\s*(?:salary|comp|compensation)[:\s]*([\d,]+)k?\s*[-–to]+\s*([\d,]+)k?/gi,
  
  // OTE patterns for sales roles
  /OTE[:\s]*\$?\s*([\d,]+)k?\s*[-–to]*\s*\$?\s*([\d,]+)?k?/gi,
];

function parseSalaryFromText(text: string): SalaryRange | null {
  if (!text) return null;
  
  // Try each pattern in order of reliability
  for (const pattern of SALARY_PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      let min = parseNumber(match[1]);
      let max = match[2] ? parseNumber(match[2]) : min * 1.3;
      
      // Handle "k" notation: 150k -> 150000
      if (min < 1000 && text.toLowerCase().includes('k')) {
        min *= 1000;
        max *= 1000;
      }
      
      // Validate range
      if (min >= 50000 && min <= 2000000) {
        return {
          min,
          max: max >= min ? max : min,
          currency: detectCurrency(text),
          period: 'yearly',
          source: 'parsed'
        };
      }
    }
  }
  
  return null;
}

function parseNumber(str: string): number {
  return parseInt(str.replace(/[,\s]/g, ''), 10);
}

function detectCurrency(text: string): string {
  if (text.includes('£')) return 'GBP';
  if (text.includes('€')) return 'EUR';
  if (text.includes('A$') || text.includes('AUD')) return 'AUD';
  if (text.includes('C$') || text.includes('CAD')) return 'CAD';
  if (text.includes('CHF')) return 'CHF';
  if (text.includes('S$') || text.includes('SGD')) return 'SGD';
  return 'USD';
}
```

## 18.6 Entry-Level Job Detection & Rejection

```typescript
// lib/job-filter.ts - Filter out non-$100k jobs

const ENTRY_LEVEL_SIGNALS = {
  // Title patterns to REJECT
  titlePatterns: [
    /\b(intern|internship)\b/i,
    /\b(junior|jr\.?)\b/i,
    /\b(entry[- ]level)\b/i,
    /\b(graduate|grad)\b/i,
    /\b(trainee|apprentice)\b/i,
    /\b(associate)\b/i,  // Often entry-level
    /\b(coordinator)\b/i, // Usually < $100k
    /\b(assistant)\b/i,   // Usually < $100k
    /\b(level\s*[1i])\b/i, // L1, Level 1, Level I
  ],
  
  // Experience patterns suggesting < $100k
  experiencePatterns: [
    /0[-–]?[12]\s*years?/i,
    /no\s*experience\s*required/i,
    /recent\s*graduat/i,
    /new\s*grad/i,
    /early\s*career/i,
    /starting\s*your\s*career/i,
  ],
  
  // Salary indicators that it's NOT $100k+
  lowSalaryIndicators: [
    /\$[4-7]\d,\d{3}/,          // $40,000 - $79,999
    /\$[4-7]\dk/i,              // $40k - $79k
    /hourly/i,                   // Usually not $100k+
  ],
};

const HIGH_LEVEL_SIGNALS = {
  // Title patterns that INDICATE $100k+ (override entry-level if present)
  titlePatterns: [
    /\b(senior|sr\.?)\b/i,
    /\b(staff)\b/i,
    /\b(principal)\b/i,
    /\b(lead)\b/i,
    /\b(manager)\b/i,
    /\b(director)\b/i,
    /\b(head\s*of)\b/i,
    /\b(vp|vice\s*president)\b/i,
    /\b(chief|c[a-z]o)\b/i,
    /\b(architect)\b/i,
    /\b(level\s*[3-9]|l[3-9])\b/i, // L3+, Level 3+
  ],
  
  // Experience suggesting $100k+
  experiencePatterns: [
    /[5-9]\+?\s*years?/i,
    /10\+?\s*years?/i,
    /\d{2}\+?\s*years?/i,
  ],
};

function isLikelyHighPayingJob(job: any): boolean {
  const title = job.title || '';
  const description = job.description || job.content || '';
  const fullText = `${title} ${description}`.toLowerCase();
  
  // Check for explicit high-level signals (override entry-level)
  const hasHighLevelTitle = HIGH_LEVEL_SIGNALS.titlePatterns.some(p => p.test(title));
  const hasHighLevelExp = HIGH_LEVEL_SIGNALS.experiencePatterns.some(p => p.test(fullText));
  
  if (hasHighLevelTitle || hasHighLevelExp) {
    return true; // Likely $100k+ even without explicit salary
  }
  
  // Check for entry-level signals
  const hasEntryLevelTitle = ENTRY_LEVEL_SIGNALS.titlePatterns.some(p => p.test(title));
  const hasEntryLevelExp = ENTRY_LEVEL_SIGNALS.experiencePatterns.some(p => p.test(fullText));
  const hasLowSalary = ENTRY_LEVEL_SIGNALS.lowSalaryIndicators.some(p => p.test(fullText));
  
  if (hasEntryLevelTitle || hasEntryLevelExp || hasLowSalary) {
    return false; // Likely NOT $100k+
  }
  
  // Ambiguous - include if salary is present and high
  return true;
}
```

## 18.7 Scraper Scheduling

### Recommended Cron Schedule (Railway)
```bash
# Railway scheduled jobs (set in railway.toml or dashboard)

# Full scrape - run twice daily (catch new postings)
0 6,18 * * *   npm run scrape:all      # 6am, 6pm UTC

# Stale job cleanup - run daily  
0 4 * * *      npm run jobs:cleanup     # Remove jobs > 30 days old

# Company discovery - run weekly
0 3 * * 0      npm run companies:discover  # Sunday 3am UTC

# Index optimization - run weekly
0 2 * * 6      npm run db:optimize      # Saturday 2am UTC
```

### Scraper Priority Order
```typescript
// Run high-value scrapers first (most jobs, best data)
const SCRAPER_PRIORITY = [
  { name: 'greenhouse', weight: 40 },  // ~40% of jobs
  { name: 'lever', weight: 30 },       // ~30% of jobs  
  { name: 'ashby', weight: 20 },       // ~20% of jobs
  { name: 'workday', weight: 10 },     // ~10% of jobs
];
```

## 18.8 Job Quality Scoring System

```typescript
// lib/job-score.ts - Score jobs for quality and relevance

interface JobScore {
  total: number;        // 0-100
  salaryScore: number;  // 0-30 points
  dataScore: number;    // 0-25 points
  companyScore: number; // 0-25 points
  freshnessScore: number; // 0-20 points
}

function calculateJobScore(job: Job, company: Company): JobScore {
  const scores = {
    // Salary quality (30 points max)
    salaryScore: scoreSalary(job),
    
    // Data completeness (25 points max)
    dataScore: scoreDataQuality(job),
    
    // Company quality (25 points max)
    companyScore: scoreCompany(company),
    
    // Freshness (20 points max)
    freshnessScore: scoreFreshness(job),
  };
  
  return {
    ...scores,
    total: Object.values(scores).reduce((a, b) => a + b, 0)
  };
}

function scoreSalary(job: Job): number {
  let score = 0;
  
  // Has structured salary data (+15)
  if (job.salaryMin && job.salaryMax) score += 15;
  else if (job.salaryMin || job.salaryMax) score += 8;
  
  // Salary is well above threshold (+10)
  if (job.salaryMax >= 150000) score += 10;
  else if (job.salaryMax >= 100000) score += 5;
  
  // Has currency info (+5)
  if (job.currency) score += 5;
  
  return Math.min(score, 30);
}

function scoreDataQuality(job: Job): number {
  let score = 0;
  
  if (job.title?.length > 10) score += 5;
  if (job.description?.length > 200) score += 5;
  if (job.location) score += 5;
  if (job.department) score += 3;
  if (job.employmentType) score += 3;
  if (job.remote !== undefined) score += 4;
  
  return Math.min(score, 25);
}

function scoreCompany(company: Company): number {
  let score = 0;
  
  if (company.logo) score += 10;
  if (company.website) score += 5;
  if (company.description?.length > 100) score += 5;
  if (company.size) score += 3;
  if (company.industry) score += 2;
  
  return Math.min(score, 25);
}

function scoreFreshness(job: Job): number {
  const daysSincePosted = daysSince(job.postedAt);
  
  if (daysSincePosted <= 1) return 20;
  if (daysSincePosted <= 7) return 15;
  if (daysSincePosted <= 14) return 10;
  if (daysSincePosted <= 30) return 5;
  return 0;
}

// Only display jobs with score >= 40
const MIN_DISPLAY_SCORE = 40;
```

## 18.9 Company Discovery Pipeline

```typescript
// scripts/discover-companies.ts
// Find new high-paying companies to add to scraping

const DISCOVERY_SOURCES = [
  // 1. Y Combinator Directory (high-paying startups)
  'https://www.ycombinator.com/companies',
  
  // 2. Inc 5000 (fast-growing companies)
  'https://www.inc.com/inc5000',
  
  // 3. Tech job boards for company names
  'https://news.ycombinator.com/jobs',
  'https://www.workatastartup.com',
  
  // 4. Funding news (recently funded = hiring)
  'https://techcrunch.com/category/funding/',
  'https://www.crunchbase.com/hub/recently-funded-companies',
];

// Extract ATS provider from careers page
async function detectATS(careersUrl: string): Promise<string | null> {
  const html = await fetch(careersUrl).then(r => r.text());
  
  if (html.includes('greenhouse.io') || html.includes('boards.greenhouse')) {
    return 'greenhouse';
  }
  if (html.includes('lever.co') || html.includes('jobs.lever.co')) {
    return 'lever';
  }
  if (html.includes('ashbyhq.com') || html.includes('jobs.ashby')) {
    return 'ashby';
  }
  if (html.includes('workday.com') || html.includes('myworkdayjobs')) {
    return 'workday';
  }
  
  return null;
}

// Weekly company discovery task
async function discoverNewCompanies() {
  // 1. Get list of known high-paying companies
  // 2. Find their careers pages
  // 3. Detect which ATS they use
  // 4. Add to database if new
  // 5. Queue for scraping
}
```

## 18.10 Data Quality Monitoring

```typescript
// scripts/monitor-quality.ts

interface QualityMetrics {
  totalJobs: number;
  jobsWithSalary: number;
  jobsWithLogo: number;
  avgJobScore: number;
  staleJobs: number;  // > 30 days old
  duplicateJobs: number;
  invalidSalaries: number;  // > $2M or < threshold
}

async function generateQualityReport(): Promise<QualityMetrics> {
  const jobs = await prisma.job.findMany({
    include: { company: true }
  });
  
  return {
    totalJobs: jobs.length,
    jobsWithSalary: jobs.filter(j => j.salaryMin > 0).length,
    jobsWithLogo: jobs.filter(j => j.company.logo).length,
    avgJobScore: calculateAvgScore(jobs),
    staleJobs: jobs.filter(j => daysSince(j.postedAt) > 30).length,
    duplicateJobs: await countDuplicates(),
    invalidSalaries: jobs.filter(j => j.salaryMax > 2000000 || 
      (j.salaryMax > 0 && j.salaryMax < 50000)).length,
  };
}

// Alert thresholds
const QUALITY_THRESHOLDS = {
  minJobsWithSalary: 0.7,   // 70% of jobs should have salary
  minJobsWithLogo: 0.8,     // 80% should have company logo
  maxStalePercentage: 0.1,  // Max 10% stale jobs
  maxDuplicates: 100,       // Max 100 duplicates
  minAvgScore: 50,          // Average score >= 50
};
```

═══════════════════════════════════════════════════════════════════════════════
      19. ATS INTEGRATION BEST PRACTICES (NEW IN v2.4)
═══════════════════════════════════════════════════════════════════════════════

## 19.1 Adding a New ATS Provider

### Step-by-Step Process
```
1. Research the ATS API documentation
2. Create scraper in: src/scrapers/{provider}.ts
3. Add company tokens to: data/companies-{provider}.json
4. Create transformer: src/transformers/{provider}.ts
5. Add to scheduler: src/jobs/scrape-scheduler.ts
6. Test with 5 companies first
7. Monitor for 24 hours before full rollout
```

### Scraper Template
```typescript
// src/scrapers/template.ts
import { BaseScraper, Job, ScrapeResult } from './types';

export class NewATSScraper extends BaseScraper {
  name = 'new-ats';
  baseUrl = 'https://api.new-ats.com';
  rateLimit = 100; // requests per minute
  
  async scrapeCompany(companyId: string): Promise<Job[]> {
    const rawJobs = await this.fetchJobs(companyId);
    return rawJobs
      .map(job => this.transformJob(job))
      .filter(job => this.meetsQualityCriteria(job));
  }
  
  transformJob(raw: any): Job {
    return {
      externalId: raw.id,
      title: raw.title,
      description: raw.description,
      salaryMin: this.extractSalaryMin(raw),
      salaryMax: this.extractSalaryMax(raw),
      currency: this.detectCurrency(raw),
      location: raw.location?.name,
      remote: this.detectRemote(raw),
      url: raw.absolute_url,
      postedAt: new Date(raw.created_at),
    };
  }
}
```

## 19.2 Handling Rate Limits

```typescript
// lib/rate-limiter.ts
import Bottleneck from 'bottleneck';

const rateLimiters = {
  greenhouse: new Bottleneck({
    maxConcurrent: 5,
    minTime: 200,  // 5 requests per second
  }),
  lever: new Bottleneck({
    maxConcurrent: 3,
    minTime: 1200, // ~50 per minute
  }),
  ashby: new Bottleneck({
    maxConcurrent: 5,
    minTime: 600,  // ~100 per minute
  }),
};

async function fetchWithRateLimit(
  provider: string, 
  url: string
): Promise<Response> {
  const limiter = rateLimiters[provider];
  return limiter.schedule(() => fetch(url));
}
```

## 19.3 Error Handling & Retries

```typescript
// lib/retry.ts
async function withRetry<T>(
  fn: () => Promise<T>,
  options: { maxRetries: number; backoff: number }
): Promise<T> {
  let lastError: Error;
  
  for (let attempt = 0; attempt < options.maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      // Don't retry on 4xx errors (client errors)
      if (error.status >= 400 && error.status < 500) {
        throw error;
      }
      
      // Exponential backoff
      const delay = options.backoff * Math.pow(2, attempt);
      await sleep(delay);
    }
  }
  
  throw lastError;
}

// Usage
const jobs = await withRetry(
  () => scraper.scrapeCompany(companyId),
  { maxRetries: 3, backoff: 1000 }
);
```

## 19.4 Deduplication Strategy

```typescript
// lib/deduplication.ts

// Generate unique hash for a job
function generateJobHash(job: Job): string {
  // Normalize title (lowercase, remove extra spaces)
  const normalizedTitle = job.title
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  // Create hash from: company + title + location
  const hashInput = [
    job.companyId,
    normalizedTitle,
    job.location?.toLowerCase() || 'unknown',
  ].join('|');
  
  return crypto.createHash('md5').update(hashInput).digest('hex');
}

// Check for duplicates before insert
async function isDuplicate(job: Job): Promise<boolean> {
  const hash = generateJobHash(job);
  
  const existing = await prisma.job.findFirst({
    where: {
      OR: [
        { externalId: job.externalId },
        { contentHash: hash },
      ],
    },
  });
  
  return !!existing;
}
```

## 19.5 Company Token Management

```json
// data/companies-greenhouse.json
{
  "companies": [
    {
      "name": "Stripe",
      "boardToken": "stripe",
      "website": "https://stripe.com",
      "priority": "high"
    },
    {
      "name": "Airbnb",
      "boardToken": "airbnb",
      "website": "https://airbnb.com",
      "priority": "high"
    }
    // ... 1000+ more companies
  ]
}
```

```typescript
// scripts/sync-companies.ts
// Sync company tokens and validate they still work

async function validateCompanyTokens() {
  const companies = await loadCompanies('greenhouse');
  
  for (const company of companies) {
    const url = `https://boards-api.greenhouse.io/v1/boards/${company.boardToken}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Invalid token for ${company.name}: ${company.boardToken}`);
      // Mark for removal or update
      await markCompanyInactive(company.id);
    }
  }
}
```

═══════════════════════════════════════════════════════════════════════════════
    20. COMPLETE pSEO TEMPLATES (COPY-PASTE READY) - NEW IN v2.5
═══════════════════════════════════════════════════════════════════════════════

## 20.1 Homepage Template

### File: `app/page.tsx`
```typescript
import { Metadata } from 'next'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: '$100k+ Jobs | 13,000+ High-Paying Six Figure Positions | Six Figure Jobs',
  description: 'Find $100k+ jobs and high-paying six figure positions from top companies. Browse 13,000+ verified salary positions in engineering, product, data, and more. Updated daily.',
  keywords: '$100k jobs, high paying jobs, six figure jobs, $100k+ jobs, 100k salary jobs, high paying remote jobs',
  alternates: {
    canonical: 'https://www.6figjobs.com',
  },
  openGraph: {
    title: '$100k+ Jobs | High-Paying Six Figure Positions',
    description: 'Find $100k+ jobs from top companies. 13,000+ verified salary positions.',
    url: 'https://www.6figjobs.com',
    siteName: 'Six Figure Jobs',
    type: 'website',
    images: [{
      url: 'https://www.6figjobs.com/og-image.png',
      width: 1200,
      height: 630,
      alt: 'Six Figure Jobs - $100k+ Positions'
    }],
  },
  twitter: {
    card: 'summary_large_image',
    title: '$100k+ Jobs | High-Paying Six Figure Positions',
    description: 'Find $100k+ jobs from top companies. 13,000+ verified salary positions.',
    images: ['https://www.6figjobs.com/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

// Homepage JSON-LD Schemas (WebSite + Organization)
function HomepageSchemas({ jobCount, companyCount }: { jobCount: number; companyCount: number }) {
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Six Figure Jobs',
    url: 'https://www.6figjobs.com',
    description: 'The exclusive job board for $100k+ positions',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://www.6figjobs.com/search?q={search_term_string}'
      },
      'query-input': 'required name=search_term_string'
    }
  }

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Six Figure Jobs',
    url: 'https://www.6figjobs.com',
    logo: 'https://www.6figjobs.com/logo.png',
    description: `Premium job board featuring ${jobCount.toLocaleString()}+ $100k+ positions from ${companyCount.toLocaleString()}+ companies`,
    sameAs: [
      'https://twitter.com/sixfigjobs',
      'https://linkedin.com/company/sixfigjobs'
    ],
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'hello@6figjobs.com',
      contactType: 'customer service'
    }
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
      />
    </>
  )
}
```

## 20.2 Role Listing Page Template

### File: `app/jobs/[role]/page.tsx`
```typescript
import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { ROLE_CONFIG } from '@/lib/roles'

interface Props {
  params: Promise<{ role: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role } = await params
  const config = ROLE_CONFIG[role]
  if (!config) return {}

  const count = await prisma.job.count({
    where: { 
      roleSlug: role,
      isHighSalaryLocal: true,
      status: 'active'
    }
  })

  const title = `${count.toLocaleString()} $100k+ ${config.title} Jobs | High-Paying ${config.title} Positions | Six Figure Jobs`
  const description = `Browse ${count.toLocaleString()} $100k+ ${config.title.toLowerCase()} jobs with verified six figure salaries. Find high-paying ${config.title.toLowerCase()} positions from top companies like Google, Stripe, and OpenAI. Updated daily.`

  return {
    title,
    description,
    keywords: `${config.title} $100k jobs, $100k ${config.title.toLowerCase()} jobs, high paying ${config.title.toLowerCase()} jobs, six figure ${config.title.toLowerCase()} positions, ${config.title.toLowerCase()} salary $100k`,
    alternates: {
      canonical: `https://www.6figjobs.com/jobs/${role}`,
    },
    openGraph: {
      title: `${count.toLocaleString()} $100k+ ${config.title} Jobs`,
      description,
      url: `https://www.6figjobs.com/jobs/${role}`,
      siteName: 'Six Figure Jobs',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title: `${count.toLocaleString()} $100k+ ${config.title} Jobs`,
      description,
    },
  }
}

// Role Page JSON-LD Schemas
function RolePageSchemas({ role, jobs, count }: { role: string; jobs: any[]; count: number }) {
  const config = ROLE_CONFIG[role]
  
  // ItemList Schema
  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `$100k+ ${config.title} Jobs`,
    description: `${count} high-paying ${config.title.toLowerCase()} positions`,
    numberOfItems: count,
    itemListElement: jobs.slice(0, 10).map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'JobPosting',
        title: job.title,
        hiringOrganization: {
          '@type': 'Organization',
          name: job.company.name,
          logo: job.company.logo
        },
        baseSalary: {
          '@type': 'MonetaryAmount',
          currency: job.currency || 'USD',
          value: {
            '@type': 'QuantitativeValue',
            minValue: job.salaryMin,
            maxValue: job.salaryMax,
            unitText: 'YEAR'
          }
        },
        jobLocation: {
          '@type': 'Place',
          address: job.location
        },
        url: `https://www.6figjobs.com/job/${job.slug}`
      }
    }))
  }

  // BreadcrumbList Schema
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: 'https://www.6figjobs.com'
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Jobs',
        item: 'https://www.6figjobs.com/jobs'
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: `${config.title} Jobs`,
        item: `https://www.6figjobs.com/jobs/${role}`
      }
    ]
  }

  // FAQPage Schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is the average salary for $100k+ ${config.title} jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The average salary for $100k+ ${config.title.toLowerCase()} positions ranges from $${Math.round(jobs.reduce((a, j) => a + j.salaryMin, 0) / jobs.length / 1000)}k to $${Math.round(jobs.reduce((a, j) => a + j.salaryMax, 0) / jobs.length / 1000)}k per year.`
        }
      },
      {
        '@type': 'Question',
        name: `How many $100k+ ${config.title} jobs are available?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `There are currently ${count.toLocaleString()} $100k+ ${config.title.toLowerCase()} positions available on Six Figure Jobs.`
        }
      },
      {
        '@type': 'Question',
        name: `Are there remote ${config.title} jobs paying $100k+?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes! Many $100k+ ${config.title.toLowerCase()} positions offer remote work. Filter by "Remote" to see all remote ${config.title.toLowerCase()} jobs.`
        }
      },
      {
        '@type': 'Question',
        name: `What companies hire $100k+ ${config.title}s?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Top companies hiring $100k+ ${config.title.toLowerCase()}s include Google, Meta, Stripe, OpenAI, Anthropic, and many more tech companies.`
        }
      }
    ]
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
    </>
  )
}

// First Paragraph Component (SEO-Optimized)
function RoleIntro({ role, count, avgMin, avgMax, topCompanies, newCount }: any) {
  const config = ROLE_CONFIG[role]
  return (
    <p className="text-lg text-zinc-400 mb-8">
      Browse <strong className="text-white">{count.toLocaleString()} {config.title.toLowerCase()} $100k jobs</strong> with 
      verified <strong className="text-green-400">six figure salaries</strong>. Find 
      <strong className="text-white"> high paying {config.title.toLowerCase()} jobs</strong> from 
      ${avgMin.toLocaleString()} to ${avgMax.toLocaleString()} at top tech companies like {topCompanies.join(', ')}.
      <span className="text-green-400"> {newCount} new $100k {config.title.toLowerCase()} positions</span> posted this week.
    </p>
  )
}
```

## 20.3 State Page Template

### File: `app/jobs/state/[state]/page.tsx`
```typescript
import { Metadata } from 'next'
import { STATE_CONFIG } from '@/lib/states'

interface Props {
  params: Promise<{ state: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { state } = await params
  const config = STATE_CONFIG[state]
  if (!config) return {}

  const count = await getJobCountByState(state)
  
  const title = `${count.toLocaleString()} $100k+ Jobs in ${config.name} | High-Paying ${config.abbr} Positions | Six Figure Jobs`
  const description = `Find ${count.toLocaleString()} $100k+ jobs in ${config.name} with verified six figure salaries. Browse high-paying positions in ${config.name} across engineering, product, data, and more. ${config.abbr} tech jobs updated daily.`

  return {
    title,
    description,
    keywords: `$100k jobs ${config.name}, ${config.name} $100k jobs, ${config.abbr} high paying jobs, ${config.name} tech jobs $100k, six figure jobs ${config.name}, $100k salary ${config.name}`,
    alternates: {
      canonical: `https://www.6figjobs.com/jobs/state/${state}`,
    },
    openGraph: {
      title: `${count.toLocaleString()} $100k+ Jobs in ${config.name}`,
      description,
      url: `https://www.6figjobs.com/jobs/state/${state}`,
    },
  }
}

// State-specific intro
function StateIntro({ state, count, topCities, avgSalary, newCount }: any) {
  const config = STATE_CONFIG[state]
  return (
    <p className="text-lg text-zinc-400 mb-8">
      Find <strong className="text-white">{count.toLocaleString()} high paying $100k jobs in {config.name}</strong> with 
      verified <strong className="text-green-400">six figure salaries</strong>. Browse 
      <strong className="text-white"> $100k+ positions in {config.name}</strong> across engineering, product, data, and more.
      Top cities: {topCities.join(', ')}. Average salary: <strong className="text-green-400">${avgSalary.toLocaleString()}</strong>.
      <span className="text-green-400"> {newCount} new $100k jobs in {config.name}</span> posted this week.
    </p>
  )
}
```

## 20.4 City Page Template

### File: `app/jobs/city/[city]/page.tsx`
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city } = await params
  const config = CITY_CONFIG[city]
  if (!config) return {}

  const count = await getJobCountByCity(city)
  
  const title = `${count.toLocaleString()} $100k+ Jobs in ${config.name} | High-Paying Positions | Six Figure Jobs`
  const description = `Find ${count.toLocaleString()} $100k+ jobs in ${config.name} with verified six figure salaries. Browse high-paying ${config.name} positions in tech, finance, and more. Updated daily.`

  return {
    title,
    description,
    keywords: `$100k jobs ${config.name}, ${config.name} $100k jobs, ${config.name} high paying jobs, ${config.name} tech jobs $100k, six figure jobs ${config.name}`,
    alternates: {
      canonical: `https://www.6figjobs.com/jobs/city/${city}`,
    },
    openGraph: {
      title: `${count.toLocaleString()} $100k+ Jobs in ${config.name}`,
      description,
      url: `https://www.6figjobs.com/jobs/city/${city}`,
    },
  }
}
```

## 20.5 Skill Page Template

### File: `app/jobs/skills/[skill]/page.tsx`
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { skill } = await params
  const config = SKILL_CONFIG[skill]
  if (!config) return {}

  const count = await getJobCountBySkill(skill)
  
  const title = `${count.toLocaleString()} $100k+ ${config.name} Jobs | High-Paying ${config.name} Developer Positions | Six Figure Jobs`
  const description = `Browse ${count.toLocaleString()} $100k+ ${config.name.toLowerCase()} jobs with verified six figure salaries. Find high-paying ${config.name.toLowerCase()} developer positions from $100k to $500k+.`

  return {
    title,
    description,
    keywords: `${config.name.toLowerCase()} $100k jobs, $100k ${config.name.toLowerCase()} developer jobs, high paying ${config.name.toLowerCase()} jobs, ${config.name.toLowerCase()} salary $100k, six figure ${config.name.toLowerCase()} positions`,
    alternates: {
      canonical: `https://www.6figjobs.com/jobs/skills/${skill}`,
    },
  }
}
```

## 20.6 Combo Page Template (Role + Remote)

### File: `app/jobs/[role]/remote/page.tsx`
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role } = await params
  const roleConfig = ROLE_CONFIG[role]
  if (!roleConfig) return {}

  const count = await getRemoteJobCountByRole(role)
  
  const title = `${count.toLocaleString()} Remote ${roleConfig.title} $100k+ Jobs | Work From Home ${roleConfig.title} | Six Figure Jobs`
  const description = `Find ${count.toLocaleString()} remote ${roleConfig.title.toLowerCase()} jobs paying $100k+. Browse work from home ${roleConfig.title.toLowerCase()} positions with verified six figure salaries. Remote-first companies hiring now.`

  return {
    title,
    description,
    keywords: `remote ${roleConfig.title.toLowerCase()} $100k jobs, work from home ${roleConfig.title.toLowerCase()}, remote ${roleConfig.title.toLowerCase()} jobs $100k, ${roleConfig.title.toLowerCase()} remote jobs six figure`,
    alternates: {
      canonical: `https://www.6figjobs.com/jobs/${role}/remote`,
    },
  }
}

// Combo page intro
function RemoteRoleIntro({ role, count, avgSalary, topCompanies, newCount }: any) {
  const config = ROLE_CONFIG[role]
  return (
    <p className="text-lg text-zinc-400 mb-8">
      Browse <strong className="text-white">{count.toLocaleString()} remote {config.title.toLowerCase()} $100k jobs</strong> with 
      verified <strong className="text-green-400">six figure salaries</strong>. Find 
      <strong className="text-white"> work from home {config.title.toLowerCase()} positions</strong> at remote-first 
      companies like {topCompanies.join(', ')}. Average salary: <strong className="text-green-400">${avgSalary.toLocaleString()}</strong>.
      <span className="text-green-400"> {newCount} new remote $100k {config.title.toLowerCase()} jobs</span> posted this week.
    </p>
  )
}
```

## 20.7 Job Detail Page Template

### File: `app/job/[slug]/page.tsx`
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const job = await getJobBySlug(slug)
  if (!job) return {}

  const salary = formatSalaryRange(job.salaryMin, job.salaryMax, job.currency)
  
  const title = `${job.title} at ${job.company.name} | ${salary} | Six Figure Jobs`
  const description = `${job.title} position at ${job.company.name} paying ${salary}. ${job.remote ? 'Remote position. ' : ''}${job.location}. Apply now for this $100k+ opportunity.`

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.6figjobs.com/job/${slug}`,
    },
    openGraph: {
      title: `${job.title} at ${job.company.name} | ${salary}`,
      description,
      url: `https://www.6figjobs.com/job/${slug}`,
      type: 'website',
    },
  }
}

// JobPosting Schema (Google for Jobs)
function JobDetailSchema({ job }: { job: any }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'JobPosting',
    title: job.title,
    description: job.description,
    identifier: {
      '@type': 'PropertyValue',
      name: job.company.name,
      value: job.externalId
    },
    datePosted: job.postedAt.toISOString(),
    validThrough: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    employmentType: job.employmentType || 'FULL_TIME',
    hiringOrganization: {
      '@type': 'Organization',
      name: job.company.name,
      sameAs: job.company.website,
      logo: job.company.logo
    },
    jobLocation: job.remote ? {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressCountry: 'US'
      }
    } : {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: job.city,
        addressRegion: job.state,
        addressCountry: job.country
      }
    },
    jobLocationType: job.remote ? 'TELECOMMUTE' : undefined,
    baseSalary: {
      '@type': 'MonetaryAmount',
      currency: job.currency || 'USD',
      value: {
        '@type': 'QuantitativeValue',
        minValue: job.salaryMin,
        maxValue: job.salaryMax,
        unitText: 'YEAR'
      }
    },
    directApply: true,
    url: `https://www.6figjobs.com/job/${job.slug}`,
    applicationContact: {
      '@type': 'ContactPoint',
      url: job.applyUrl
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

## 20.8 Company Page Template

### File: `app/company/[slug]/page.tsx`
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const company = await getCompanyBySlug(slug)
  if (!company) return {}

  const jobCount = await getJobCountByCompany(company.id)
  
  const title = `${company.name} $100k+ Jobs | ${jobCount} High-Paying Positions | Six Figure Jobs`
  const description = `Browse ${jobCount} $100k+ jobs at ${company.name}. Find high-paying positions with verified six figure salaries. ${company.description?.slice(0, 100)}...`

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.6figjobs.com/company/${slug}`,
    },
    openGraph: {
      title: `${company.name} $100k+ Jobs`,
      description,
      url: `https://www.6figjobs.com/company/${slug}`,
      images: company.logo ? [{ url: company.logo }] : undefined,
    },
  }
}

// Organization Schema for Company Page
function CompanySchema({ company, jobCount }: { company: any; jobCount: number }) {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: company.name,
    url: company.website,
    logo: company.logo,
    description: company.description,
    numberOfEmployees: company.size ? {
      '@type': 'QuantitativeValue',
      value: company.size
    } : undefined,
    sameAs: [company.linkedin, company.twitter].filter(Boolean)
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

## 20.9 Salary Guide Page Template

### File: `app/salary/[role]/page.tsx`
```typescript
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { role } = await params
  const config = ROLE_CONFIG[role]
  if (!config) return {}

  const stats = await getSalaryStatsByRole(role)
  
  const title = `$100k+ ${config.title} Salaries | ${config.title} Salary Guide 2025 | Six Figure Jobs`
  const description = `$100k+ ${config.title.toLowerCase()} salaries range from $${Math.round(stats.p25/1000)}k to $${Math.round(stats.p90/1000)}k. Median: $${Math.round(stats.median/1000)}k. Based on ${stats.count} verified high-paying positions.`

  return {
    title,
    description,
    keywords: `${config.title.toLowerCase()} salary, ${config.title.toLowerCase()} salary $100k, how much do ${config.title.toLowerCase()}s make, ${config.title.toLowerCase()} compensation, ${config.title.toLowerCase()} pay`,
    alternates: {
      canonical: `https://www.6figjobs.com/salary/${role}`,
    },
  }
}

// Occupation Schema for Salary Guide
function SalaryGuideSchema({ role, stats }: { role: string; stats: any }) {
  const config = ROLE_CONFIG[role]
  
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Occupation',
    name: config.title,
    description: `$100k+ ${config.title} positions`,
    occupationLocation: {
      '@type': 'Country',
      name: 'United States'
    },
    estimatedSalary: {
      '@type': 'MonetaryAmountDistribution',
      name: `$100k+ ${config.title} Salary`,
      currency: 'USD',
      duration: 'P1Y',
      percentile25: stats.p25,
      median: stats.median,
      percentile75: stats.p75,
      percentile90: stats.p90
    }
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  )
}
```

═══════════════════════════════════════════════════════════════════════════════
    21. ADVANCED SEO CHECKLIST & DATA VALIDATION - NEW IN v2.5
═══════════════════════════════════════════════════════════════════════════════

## 21.1 Pre-Launch SEO Checklist

### Technical SEO ✅
- [ ] All pages have unique title tags (< 60 chars)
- [ ] All pages have meta descriptions (< 160 chars)
- [ ] All pages have canonical URLs
- [ ] All pages have Open Graph tags
- [ ] All pages have Twitter Card tags
- [ ] Homepage has WebSite schema
- [ ] Homepage has Organization schema
- [ ] Job listings have ItemList schema
- [ ] Job details have JobPosting schema
- [ ] All pages have BreadcrumbList schema
- [ ] Salary guides have Occupation schema
- [ ] FAQ pages have FAQPage schema
- [ ] sitemap.xml includes all pages
- [ ] robots.txt is correctly configured
- [ ] Staging has noindex meta tag

### Content SEO ✅
- [ ] Every page H1 includes "$100k" or "high paying"
- [ ] Every page first paragraph includes all 3 primary keywords
- [ ] Job count is dynamic and accurate
- [ ] Salary ranges are displayed prominently
- [ ] Internal links use keyword-rich anchor text
- [ ] Footer contains all pSEO category links
- [ ] 404 page exists and is helpful
- [ ] Search results page exists

### Core Web Vitals ✅
- [ ] LCP (Largest Contentful Paint) < 2.5s
- [ ] FID (First Input Delay) < 100ms
- [ ] CLS (Cumulative Layout Shift) < 0.1
- [ ] Mobile-friendly (responsive)
- [ ] Images are optimized (WebP, lazy loading)
- [ ] Fonts are preloaded

### International SEO (If Applicable)
- [ ] hreflang tags for country pages
- [ ] Currency displayed in local format
- [ ] Salary thresholds are PPP-adjusted

## 21.2 Data Validation Rules

### Job Data Validation
```typescript
// lib/validation.ts

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function validateJob(job: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!job.title || job.title.length < 5) {
    errors.push('Job title is required and must be > 5 chars');
  }
  if (!job.companyId) {
    errors.push('Company ID is required');
  }
  if (!job.description || job.description.length < 50) {
    warnings.push('Description should be > 50 chars for SEO');
  }

  // Salary validation
  if (job.salaryMin && job.salaryMax) {
    // Check for cents bug (values in cents instead of dollars)
    if (job.salaryMin > 1000000 || job.salaryMax > 1000000) {
      errors.push('Salary appears to be in cents - divide by 100');
    }
    // Check for obviously wrong salaries
    if (job.salaryMin < 30000) {
      errors.push('Salary min too low for $100k+ job board');
    }
    if (job.salaryMax > 5000000) {
      errors.push('Salary max suspiciously high - verify data');
    }
    // Check min < max
    if (job.salaryMin > job.salaryMax) {
      errors.push('Salary min is greater than max');
    }
    // Check reasonable range spread
    if (job.salaryMax > job.salaryMin * 3) {
      warnings.push('Salary range spread is very wide (>3x)');
    }
  }

  // URL validation
  if (job.applyUrl && !isValidUrl(job.applyUrl)) {
    errors.push('Apply URL is invalid');
  }

  // Location validation
  if (!job.location && !job.remote) {
    warnings.push('Job has no location and is not marked remote');
  }

  // Entry-level detection
  const entryLevelPatterns = /\b(intern|junior|jr\.?|entry[- ]level|graduate|trainee)\b/i;
  if (entryLevelPatterns.test(job.title)) {
    errors.push('Title contains entry-level keywords - should not be on $100k+ board');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}

// Batch validation for data quality report
async function generateDataQualityReport() {
  const jobs = await prisma.job.findMany({
    where: { status: 'active' }
  });

  const results = {
    total: jobs.length,
    valid: 0,
    invalid: 0,
    withWarnings: 0,
    errorTypes: {} as Record<string, number>,
    warningTypes: {} as Record<string, number>
  };

  for (const job of jobs) {
    const validation = validateJob(job);
    
    if (validation.valid) {
      results.valid++;
    } else {
      results.invalid++;
    }
    
    if (validation.warnings.length > 0) {
      results.withWarnings++;
    }

    validation.errors.forEach(err => {
      results.errorTypes[err] = (results.errorTypes[err] || 0) + 1;
    });
    
    validation.warnings.forEach(warn => {
      results.warningTypes[warn] = (results.warningTypes[warn] || 0) + 1;
    });
  }

  return results;
}
```

### URL Validation & Slug Generation
```typescript
// lib/slugs.ts

function generateJobSlug(job: any): string {
  // Format: company-title-id
  // e.g., stripe-senior-software-engineer-abc123
  const companySlug = slugify(job.company.name);
  const titleSlug = slugify(job.title);
  const shortId = job.externalId?.slice(-6) || generateShortId();
  
  return `${companySlug}-${titleSlug}-${shortId}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')  // Replace non-alphanumeric with -
    .replace(/^-|-$/g, '')         // Remove leading/trailing -
    .replace(/--+/g, '-')          // Replace multiple - with single -
    .slice(0, 50);                  // Limit length
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Check for duplicate slugs
async function ensureUniqueSlug(slug: string): Promise<string> {
  const existing = await prisma.job.findFirst({ where: { slug } });
  if (!existing) return slug;
  
  // Append random chars if duplicate
  return `${slug}-${generateShortId()}`;
}
```

### Company Data Validation
```typescript
function validateCompany(company: any): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!company.name || company.name.length < 2) {
    errors.push('Company name is required');
  }

  // Logo validation
  if (!company.logo) {
    warnings.push('Company has no logo - will affect job card appearance');
  } else if (!isValidUrl(company.logo)) {
    errors.push('Company logo URL is invalid');
  }

  // Website validation
  if (company.website && !isValidUrl(company.website)) {
    errors.push('Company website URL is invalid');
  }

  // ATS token validation
  if (company.atsProvider && !company.atsToken) {
    errors.push('ATS provider specified but no token provided');
  }

  return { valid: errors.length === 0, errors, warnings };
}
```

## 21.3 Automated SEO Health Checks

```typescript
// scripts/seo-health-check.ts

async function runSEOHealthCheck() {
  const issues: string[] = [];
  const warnings: string[] = [];

  // 1. Check for duplicate titles
  const titles = await prisma.job.groupBy({
    by: ['title', 'companyId'],
    _count: true,
    having: { title: { _count: { gt: 1 } } }
  });
  if (titles.length > 0) {
    warnings.push(`Found ${titles.length} duplicate job titles`);
  }

  // 2. Check for missing slugs
  const missingSlug = await prisma.job.count({
    where: { slug: null }
  });
  if (missingSlug > 0) {
    issues.push(`${missingSlug} jobs missing slugs - will cause 404s`);
  }

  // 3. Check for stale jobs (> 60 days old)
  const staleJobs = await prisma.job.count({
    where: {
      postedAt: { lt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000) },
      status: 'active'
    }
  });
  if (staleJobs > 0) {
    warnings.push(`${staleJobs} active jobs are > 60 days old - consider marking stale`);
  }

  // 4. Check for jobs without salary
  const noSalary = await prisma.job.count({
    where: { salaryMin: null, status: 'active' }
  });
  const total = await prisma.job.count({ where: { status: 'active' } });
  const salaryPercentage = ((total - noSalary) / total * 100).toFixed(1);
  if (parseFloat(salaryPercentage) < 70) {
    issues.push(`Only ${salaryPercentage}% of jobs have salary data - target is 70%+`);
  }

  // 5. Check for companies without logos
  const noLogo = await prisma.company.count({
    where: { logo: null }
  });
  const totalCompanies = await prisma.company.count();
  const logoPercentage = ((totalCompanies - noLogo) / totalCompanies * 100).toFixed(1);
  if (parseFloat(logoPercentage) < 80) {
    warnings.push(`Only ${logoPercentage}% of companies have logos - target is 80%+`);
  }

  // 6. Check sitemap is recent
  // (Would check file modification time or last generation timestamp)

  console.log('\n=== SEO Health Check Results ===\n');
  console.log(`Issues (${issues.length}):`);
  issues.forEach(i => console.log(`  ❌ ${i}`));
  console.log(`\nWarnings (${warnings.length}):`);
  warnings.forEach(w => console.log(`  ⚠️ ${w}`));
  
  return { issues, warnings };
}
```

═══════════════════════════════════════════════════════════════════════════════
        22. INTERNAL LINKING STRATEGY - NEW IN v2.5
═══════════════════════════════════════════════════════════════════════════════

## 22.1 Linking Rules

### Anchor Text Rules (CRITICAL FOR SEO)
```
✅ ALWAYS include "$100k" in anchor text for job links:
   - "$100k+ Software Engineer jobs"
   - "Browse $100k jobs in California"
   - "Remote $100k positions"

❌ NEVER use generic anchor text:
   - "Click here"
   - "View jobs"
   - "Learn more"
```

### Page-to-Page Linking Matrix

| From Page | Link To | Anchor Text Pattern |
|-----------|---------|---------------------|
| Homepage | Role pages | "$100k+ [Role] jobs" |
| Homepage | State pages | "$100k jobs in [State]" |
| Homepage | Salary tiers | "$200k+ jobs" |
| Role page | Remote combo | "Remote [Role] $100k jobs" |
| Role page | City combos | "[Role] $100k jobs in [City]" |
| State page | City pages | "$100k jobs in [City], [State]" |
| Job detail | Company page | "More $100k jobs at [Company]" |
| Job detail | Related jobs | "Similar $100k [Role] positions" |
| Company page | Job listings | "$100k positions at [Company]" |
| Salary guide | Role page | "$100k+ [Role] jobs" |

## 22.2 Related Jobs Component

```typescript
// components/RelatedJobs.tsx
// Display on job detail pages

interface RelatedJobsProps {
  currentJob: Job;
}

export async function RelatedJobs({ currentJob }: RelatedJobsProps) {
  // Fetch related jobs by: same role, same company, same location
  const relatedByRole = await getJobsByRole(currentJob.roleSlug, 3);
  const relatedByCompany = await getJobsByCompany(currentJob.companyId, 3);
  const relatedByLocation = await getJobsByLocation(currentJob.location, 3);

  return (
    <section className="mt-12">
      <h2 className="text-xl font-bold mb-6">More $100k+ Positions</h2>
      
      {/* Same Role */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">
          Similar $100k+ {currentJob.roleTitle} Jobs
        </h3>
        <div className="grid gap-4">
          {relatedByRole.map(job => (
            <JobCard key={job.id} job={job} variant="compact" />
          ))}
        </div>
        <Link 
          href={`/jobs/${currentJob.roleSlug}`}
          className="text-green-400 hover:underline mt-4 inline-block"
        >
          View all $100k+ {currentJob.roleTitle} jobs →
        </Link>
      </div>

      {/* Same Company */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold mb-4">
          More $100k+ Jobs at {currentJob.company.name}
        </h3>
        <div className="grid gap-4">
          {relatedByCompany.map(job => (
            <JobCard key={job.id} job={job} variant="compact" />
          ))}
        </div>
        <Link 
          href={`/company/${currentJob.company.slug}`}
          className="text-green-400 hover:underline mt-4 inline-block"
        >
          View all positions at {currentJob.company.name} →
        </Link>
      </div>
    </section>
  );
}
```

## 22.3 Breadcrumb Component

```typescript
// components/Breadcrumbs.tsx

interface BreadcrumbItem {
  label: string;
  href?: string;
}

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex items-center gap-2 text-sm text-zinc-400">
        <li>
          <Link href="/" className="hover:text-white">
            $100k+ Jobs
          </Link>
        </li>
        {items.map((item, index) => (
          <li key={index} className="flex items-center gap-2">
            <span>/</span>
            {item.href ? (
              <Link href={item.href} className="hover:text-white">
                {item.label}
              </Link>
            ) : (
              <span className="text-white">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

// Usage examples:
// Role page: Home > Jobs > Software Engineer
// Combo page: Home > Jobs > Software Engineer > Remote
// Job detail: Home > Jobs > Software Engineer > [Company] - [Title]
```

## 22.4 Footer Link Structure (SEO Power)

```typescript
// components/Footer.tsx

export function Footer() {
  return (
    <footer className="bg-zinc-950 border-t border-zinc-800 py-16">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-8">
        
        {/* $100k+ Jobs by Role */}
        <div>
          <h3 className="font-semibold text-white mb-4">$100k+ Jobs by Role</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/jobs/software-engineer">$100k Software Engineer Jobs</Link></li>
            <li><Link href="/jobs/product-manager">$100k Product Manager Jobs</Link></li>
            <li><Link href="/jobs/data-scientist">$100k Data Scientist Jobs</Link></li>
            <li><Link href="/jobs/devops-engineer">$100k DevOps Engineer Jobs</Link></li>
            <li><Link href="/jobs/machine-learning-engineer">$100k ML Engineer Jobs</Link></li>
          </ul>
        </div>

        {/* $100k+ Jobs by Location */}
        <div>
          <h3 className="font-semibold text-white mb-4">$100k+ Jobs by Location</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/jobs/state/california">$100k Jobs in California</Link></li>
            <li><Link href="/jobs/state/texas">$100k Jobs in Texas</Link></li>
            <li><Link href="/jobs/state/new-york">$100k Jobs in New York</Link></li>
            <li><Link href="/jobs/city/san-francisco">$100k Jobs in San Francisco</Link></li>
            <li><Link href="/remote">$100k Remote Jobs</Link></li>
          </ul>
        </div>

        {/* $100k+ Jobs by Skill */}
        <div>
          <h3 className="font-semibold text-white mb-4">$100k+ Jobs by Skill</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/jobs/skills/python">$100k Python Jobs</Link></li>
            <li><Link href="/jobs/skills/react">$100k React Jobs</Link></li>
            <li><Link href="/jobs/skills/typescript">$100k TypeScript Jobs</Link></li>
            <li><Link href="/jobs/skills/aws">$100k AWS Jobs</Link></li>
            <li><Link href="/jobs/skills/kubernetes">$100k Kubernetes Jobs</Link></li>
          </ul>
        </div>

        {/* $100k+ Jobs by Salary */}
        <div>
          <h3 className="font-semibold text-white mb-4">High-Paying Jobs</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/jobs/100k-plus">$100k+ Jobs</Link></li>
            <li><Link href="/jobs/150k-plus">$150k+ Jobs</Link></li>
            <li><Link href="/jobs/200k-plus">$200k+ Jobs</Link></li>
            <li><Link href="/jobs/300k-plus">$300k+ Jobs</Link></li>
            <li><Link href="/jobs/400k-plus">$400k+ Jobs</Link></li>
          </ul>
        </div>

        {/* Salary Guides */}
        <div>
          <h3 className="font-semibold text-white mb-4">Salary Guides</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/salary/software-engineer">Software Engineer Salaries</Link></li>
            <li><Link href="/salary/product-manager">Product Manager Salaries</Link></li>
            <li><Link href="/salary/data-scientist">Data Scientist Salaries</Link></li>
            <li><Link href="/salary/devops-engineer">DevOps Engineer Salaries</Link></li>
          </ul>
        </div>

        {/* Company */}
        <div>
          <h3 className="font-semibold text-white mb-4">Six Figure Jobs</h3>
          <ul className="space-y-2 text-sm text-zinc-400">
            <li><Link href="/about">About Us</Link></li>
            <li><Link href="/companies">Companies Hiring</Link></li>
            <li><Link href="/blog">Blog</Link></li>
            <li><Link href="/contact">Contact</Link></li>
          </ul>
        </div>

      </div>
    </footer>
  );
}
```

═══════════════════════════════════════════════════════════════════════════════
    23. PROJECT MANAGEMENT & TECHNICAL DEBT - NEW IN v2.5
═══════════════════════════════════════════════════════════════════════════════

## 23.1 Known Technical Debt

### Critical (Fix Immediately)
- [ ] `/jobs/[role]/[city]` vs `/jobs/[role]/[filter]` route conflict
- [ ] Duplicate company records in database
- [ ] Missing favicon fallback chain

### High Priority (This Week)
- [ ] Homepage WebSite + Organization schemas
- [ ] Core Web Vitals optimization
- [ ] Mobile hamburger menu accessibility
- [ ] Job card loading skeleton states

### Medium Priority (This Month)
- [ ] Workday scraper integration
- [ ] iCIMS scraper integration
- [ ] Email alerts feature
- [ ] Saved jobs (localStorage)

### Low Priority (Backlog)
- [ ] User profiles & accounts
- [ ] Application tracker
- [ ] AI resume builder
- [ ] Company reviews

## 23.2 File Organization Standard

```
app/
├── (marketing)/           # Static pages (about, contact)
├── jobs/
│   ├── page.tsx          # /jobs (all jobs)
│   ├── [role]/
│   │   ├── page.tsx      # /jobs/software-engineer
│   │   ├── remote/
│   │   │   └── page.tsx  # /jobs/software-engineer/remote
│   │   └── city/
│   │       └── [city]/
│   │           └── page.tsx  # /jobs/software-engineer/city/san-francisco
│   ├── state/
│   │   └── [state]/
│   │       └── page.tsx  # /jobs/state/california
│   ├── city/
│   │   └── [city]/
│   │       └── page.tsx  # /jobs/city/san-francisco
│   ├── skills/
│   │   └── [skill]/
│   │       ├── page.tsx  # /jobs/skills/python
│   │       └── remote/
│   │           └── page.tsx  # /jobs/skills/python/remote
│   ├── industry/
│   │   └── [industry]/
│   │       └── page.tsx  # /jobs/industry/fintech
│   └── [tier]-plus/
│       └── page.tsx      # /jobs/200k-plus
├── job/
│   └── [slug]/
│       └── page.tsx      # /job/stripe-senior-swe-abc123
├── company/
│   └── [slug]/
│       └── page.tsx      # /company/stripe
├── salary/
│   └── [role]/
│       ├── page.tsx      # /salary/software-engineer
│       └── [location]/
│           └── page.tsx  # /salary/software-engineer/san-francisco
└── remote/
    └── page.tsx          # /remote

components/
├── ui/                   # Primitives (Button, Card, Input)
├── job/                  # Job-related (JobCard, JobList, JobFilters)
├── company/              # Company-related (CompanyCard, CompanyLogo)
├── layout/               # Layout (Header, Footer, Sidebar)
├── seo/                  # SEO (Schemas, Breadcrumbs)
└── shared/               # Shared (Pagination, Empty, Loading)

lib/
├── prisma.ts             # Database client
├── roles.ts              # Role configuration
├── states.ts             # State configuration
├── cities.ts             # City configuration
├── skills.ts             # Skill configuration
├── validation.ts         # Data validation
├── salary-parser.ts      # Salary extraction
├── slugs.ts              # Slug generation
└── utils.ts              # General utilities

scrapers/
├── greenhouse.ts
├── lever.ts
├── ashby.ts
├── types.ts
└── index.ts

scripts/
├── scrape-all.ts         # Main scraper orchestration
├── cleanup-jobs.ts       # Remove stale jobs
├── discover-companies.ts # Find new companies
├── seo-health-check.ts   # SEO validation
└── generate-sitemap.ts   # Sitemap generation
```

## 23.3 Code Quality Standards

### TypeScript Strict Mode
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### ESLint Rules
```json
// .eslintrc.json
{
  "extends": ["next/core-web-vitals"],
  "rules": {
    "no-console": "warn",
    "prefer-const": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

### Naming Conventions
```
Files:       kebab-case (job-card.tsx)
Components:  PascalCase (JobCard)
Functions:   camelCase (formatSalary)
Constants:   SCREAMING_SNAKE_CASE (SALARY_THRESHOLDS)
Types:       PascalCase (JobPosting)
Routes:      kebab-case (/jobs/software-engineer)
```

## 23.4 Database Indexes for Performance

```sql
-- Critical indexes for query performance
CREATE INDEX idx_jobs_role_status ON jobs(role_slug, status);
CREATE INDEX idx_jobs_location_status ON jobs(location, status);
CREATE INDEX idx_jobs_salary_high ON jobs(is_high_salary_local, status);
CREATE INDEX idx_jobs_company ON jobs(company_id);
CREATE INDEX idx_jobs_posted ON jobs(posted_at DESC);
CREATE INDEX idx_jobs_slug ON jobs(slug);
CREATE INDEX idx_companies_slug ON companies(slug);
CREATE INDEX idx_companies_ats ON companies(ats_provider, ats_token);
```

═══════════════════════════════════════════════════════════════════════════════
    24. SAFE pSEO EXPANSION STRATEGY - AVOID GOOGLE PENALTIES
═══════════════════════════════════════════════════════════════════════════════

## 24.1 Phased Rollout Schedule (12-Week Plan)

### Phase 1: Foundation (Weeks 1-2) - 20 pages total
- Week 1: Top 10 roles (Software Engineer, Product Manager, Data Scientist, etc.) - 100+ jobs each
- Week 2: Top 10 states (California, Texas, New York, Washington, etc.) - 200+ jobs each
- **Publishing Rate:** 10 pages/week
- **Quality Gate:** >100 jobs per page, full metadata, 3+ schemas

### Phase 2: Expansion (Weeks 3-6) - 80 more pages (100 total)
- Week 3: Top 15 skills (Python, React, TypeScript, AWS, etc.) - 50+ jobs each
- Week 4: Top 10 cities (San Francisco, NYC, Seattle, Austin, etc.) - 100+ jobs each
- Week 5: Remaining 15 roles - 30+ jobs each
- Week 6: Remaining 40 states - 10+ jobs each
- **Publishing Rate:** 20 pages/week
- **Quality Gate:** >30 jobs per page

### Phase 3: Combinations (Weeks 7-10) - 120 more pages (220 total)
- Week 7-8: Top 5 roles × Top 10 cities (50 pages) - 20+ jobs each
- Week 9: Top 10 roles × Remote (10 pages) - 50+ jobs each
- Week 10: Top 10 skills × Remote (10 pages) + Role × State combos (50 pages)
- **Publishing Rate:** 30 pages/week
- **Quality Gate:** >20 jobs per combo page

### Phase 4: Completion (Weeks 11-12) - 100 more pages (320 total)
- Week 11-12: Industry pages, deep combos, skill variations
- **Publishing Rate:** 50 pages/week (maximum safe rate)
- **Quality Gate:** >10 jobs per page (strict minimum)

## 24.2 Quality Gates (MANDATORY CHECKS)

**Minimum Requirements per Page:**
- ✅ At least 5 jobs (absolute minimum) - 10+ recommended
- ✅ 200+ characters of unique content
- ✅ <30% similarity with other pages
- ✅ H1 tag with "$100k" keyword
- ✅ Unique title tag (<60 chars) + description (<160 chars)
- ✅ Canonical URL, OpenGraph, Twitter Card
- ✅ ItemList + BreadcrumbList + FAQPage schemas
- ✅ 5+ internal links to related pages
- ✅ <2.5s page load time (LCP)
- ✅ "Updated X ago" timestamp
- ✅ "X new jobs this week" counter

**Auto-Skip Logic:**
```typescript
// Skip publishing if:
if (jobCount < 5) return false;  // Too few jobs
if (uniqueContent.length < 200) return false;  // Content too short
if (!hasH1 || !hasMetadata || !hasSchema) return false;  // Missing SEO elements
```

## 24.3 Red Flags to STOP Publishing

**CRITICAL (Auto-disable publishing):**
- 🚨 Google Search Console manual action detected
- 🚨 GSC coverage drops >10% in one week

**WARNINGS (Review but continue):**
- ⚠️ GSC coverage below 70%
- ⚠️ Average jobs per page <15
- ⚠️ Page load time >3s
- ⚠️ Over weekly publishing limit

## 24.4 Success Criteria by Week

| Week | Pages Total | Min GSC Indexed | Coverage % | Avg Jobs/Page |
|------|-------------|-----------------|------------|---------------|
| 2    | 20          | 15              | 75%        | 100+          |
| 6    | 100         | 80              | 80%        | 50+           |
| 10   | 220         | 180             | 82%        | 35+           |
| 12   | 320         | 260             | 80%        | 30+           |

## 24.5 Rollback Plan (If Manual Action Occurs)

**Day 1:** STOP publishing immediately. Document manual action from GSC.
**Days 2-7:** Add noindex to pages <5 jobs. Remove from sitemap pages <10 jobs. Submit reconsideration request.
**Weeks 2-4:** Wait for Google response. Monitor GSC daily. Do NOT publish new pages.
**Week 5+:** Restart at Phase 1 rates with doubled minimums (20 jobs/page). Max 5 pages/day for 2 weeks.

═══════════════════════════════════════════════════════════════════════════════
    14.13 CORE WEB VITALS OPTIMIZATION
═══════════════════════════════════════════════════════════════════════════════

## 14.13.1 Largest Contentful Paint (LCP) - Target: < 2.5s

**Priority 1: Preload Critical Resources**
```tsx
// app/layout.tsx - Add to <head>
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
<link rel="preconnect" href="https://img.logo.dev" />
<link rel="dns-prefetch" href="https://img.logo.dev" />
```

**Priority 2: Optimize Above-Fold Images**
```tsx
// First 3 job cards only
<Image
  src={job.company.logo}
  alt={`${job.company.name} logo`}
  width={48}
  height={48}
  priority={index < 3}  // Only first 3 cards
  loading={index < 3 ? 'eager' : 'lazy'}
/>
```

**Priority 3: Lazy Load Heavy Components**
```tsx
// Lazy load filters and non-critical UI
const JobFilters = dynamic(() => import('@/components/JobFilters'), {
  loading: () => <FilterSkeleton />,
  ssr: false,  // Client-side only
});
```

## 14.13.2 First Input Delay (FID) - Target: < 100ms

**Priority 1: Debounce Search Input**
```tsx
import { useDebouncedCallback } from 'use-debounce'

const debouncedSearch = useDebouncedCallback((value: string) => {
  setSearch(value);
}, 300);  // 300ms delay
```

**Priority 2: Virtualize Long Lists (100+ items)**
```tsx
import { useVirtualizer } from '@tanstack/react-virtual'

// Only render visible job cards
const virtualizer = useVirtualizer({
  count: jobs.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 200,  // Job card height
});
```

## 14.13.3 Cumulative Layout Shift (CLS) - Target: < 0.1

**Priority 1: Reserve Space for Images**
```tsx
// WRONG (causes layout shift):
<img src={logo} alt="" />

// RIGHT (reserves space):
<div className="w-12 h-12 bg-zinc-800 rounded-lg">
  <Image src={logo} alt={company.name} width={48} height={48} />
</div>
```

**Priority 2: Use Skeleton Loaders**
```tsx
export function JobCardSkeleton() {
  return (
    <article className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
      <div className="flex gap-4">
        <div className="w-12 h-12 bg-zinc-800 rounded-lg animate-pulse" />
        <div className="flex-1 space-y-2">
          <div className="h-5 bg-zinc-800 rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-zinc-800 rounded w-1/2 animate-pulse" />
        </div>
      </div>
    </article>
  );
}
```

**Priority 3: Prevent Font Layout Shifts**
```css
/* app/globals.css */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter-var.woff2') format('woff2');
  font-display: swap;  /* Prevent invisible text flash */
}
```

═══════════════════════════════════════════════════════════════════════════════
    4.6 ADVANCED KEYWORD OPTIMIZATION
═══════════════════════════════════════════════════════════════════════════════

## 4.6.1 LSI Keywords (Latent Semantic Indexing)

**Primary: "$100k jobs" → LSI variants:**
- six figure jobs, six figure salary, high paying jobs, high compensation, top paying roles, premium positions, competitive salary, lucrative opportunities, well-paid positions

**Primary: "software engineer" → LSI variants:**
- SWE, software developer, developer, engineer, programmer, coder, software engineering, development engineer

**Primary: "remote" → LSI variants:**
- work from home, WFH, distributed, remote-first, remote-friendly, work from anywhere, location independent, virtual position, telecommute

## 4.6.2 Enhanced First Paragraph Template

**CURRENT (Good):**
```
Browse 3,240 software engineer $100k jobs with verified six figure salaries. 
Find high paying software engineer jobs from $120k to $500k at top tech companies.
127 new $100k software engineer positions posted this week.
```

**ENHANCED (Better - More LSI):**
```
Browse 3,240 software engineer $100k jobs with verified six figure salaries. 
Find high paying software developer positions paying $120,000 to $500,000 per year 
from top tech companies like Google, Stripe, and Anthropic. These premium SWE roles 
offer competitive compensation packages including equity, bonuses, and comprehensive benefits. 
127 new $100k software engineering jobs posted this week across remote, hybrid, and onsite opportunities.
```

**Improvements:**
- ✅ Added LSI: "software developer", "premium SWE roles", "competitive compensation"
- ✅ More natural language flow
- ✅ Mentioned benefits (equity, bonuses) for relevance
- ✅ Added work arrangements (remote, hybrid, onsite)

## 4.6.3 Section Headers (H2) - Keyword-Rich

**BEFORE (Generic):**
```tsx
<h2>Latest Jobs</h2>
<h2>Top Companies</h2>
```

**AFTER (Keyword-Rich):**
```tsx
<h2>Latest $100k+ Software Engineer Jobs</h2>
<h2>Top Companies Hiring $100k+ Engineers</h2>
<h2>Related $100k+ Software Engineering Positions</h2>
<h2>Remote $100k+ Software Developer Opportunities</h2>
<h2>Six Figure Software Engineer Salaries by Location</h2>
```

**Rule:** Every H2 MUST include at least ONE of: "$100k", "high paying", "six figure"

## 4.6.4 Image Alt Tags (CURRENTLY MISSING - ADD THIS)

**Company Logos:**
```tsx
// WRONG:
<Image src={company.logo} alt={company.name} />

// RIGHT:
<Image 
  src={company.logo} 
  alt={`${company.name} logo - Hiring $100k+ ${role} jobs`}
  width={48}
  height={48}
/>
```

**Hero Images:**
```tsx
<Image
  src="/hero-bg.webp"
  alt="Browse 13,000+ high-paying six figure jobs - $100k to $500k positions from top tech companies"
  width={1200}
  height={600}
  priority
/>
```

## 4.6.5 Meta Description Enhancement

**BEFORE:**
```typescript
description: `Find ${count} $100k+ ${role} jobs. Browse high-paying positions.`
```

**AFTER (More Compelling + LSI):**
```typescript
description: `Browse ${count.toLocaleString()} $100k+ ${role} jobs with verified six figure salaries. Find high-paying ${role.toLowerCase()} positions from $${minK}k to $${maxK}k at top companies. ${newCount} new jobs this week.`
```

**Key Improvements:**
- ✅ Include exact job count (social proof)
- ✅ Mention salary range (value prop)
- ✅ Include "verified" (trust signal)
- ✅ Add urgency ("X new this week")
- ✅ Use LSI keywords naturally

═══════════════════════════════════════════════════════════════════════════════
    25. CONTENT FRESHNESS & RECRAWL SIGNALS
═══════════════════════════════════════════════════════════════════════════════

## 25.1 Dynamic Update Timestamps

**Display Last Update Time on ALL listing pages:**
```tsx
// components/PageHeader.tsx
export function PageHeader({ title, count, lastUpdated, newThisWeek }) {
  return (
    <header>
      <h1 className="text-4xl font-bold">{title}</h1>
      
      <div className="flex items-center gap-4 mt-4 text-sm text-zinc-500">
        <span className="flex items-center gap-2">
          <ClockIcon className="w-4 h-4" />
          Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
        </span>
        
        {newThisWeek > 0 && (
          <span className="flex items-center gap-2 text-green-400">
            <TrendingUpIcon className="w-4 h-4" />
            {newThisWeek} new jobs this week
          </span>
        )}
      </div>
    </header>
  );
}
```

## 25.2 Sitemap LastMod (UPGRADE FROM LOW TO HIGH PRIORITY)

**CURRENT ISSUE:** Sitemap lastmod always shows "now" (not accurate)

**FIX:** Use actual page update timestamp
```typescript
// app/sitemap.xml/route.ts
export async function GET() {
  const pages = await prisma.pseoPage.findMany({
    select: { url: true, updatedAt: true, priority: true },
  });
  
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${pages.map(page => `
  <url>
    <loc>${page.url}</loc>
    <lastmod>${page.updatedAt.toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>${page.priority}</priority>
  </url>
  `).join('')}
</urlset>`;
  
  return new Response(sitemap, {
    headers: { 'Content-Type': 'application/xml' },
  });
}
```

**Update Triggers - When to update page.updatedAt:**
1. New jobs added to category → Update timestamp
2. Jobs removed (expired/filled) → Update timestamp
3. Salary stats changed >10% → Update timestamp
4. Content enhanced (FAQ added, description updated) → Update timestamp

## 25.3 Job Cards - Highlight NEW/HOT
```tsx
// components/job/JobCard.tsx
export function JobCard({ job }) {
  const isNew = daysSince(job.postedAt) <= 3;
  const isHot = daysSince(job.postedAt) <= 1;
  
  return (
    <article className="relative ...">
      {isNew && (
        <span className="absolute top-3 right-3 bg-green-500/10 text-green-400 
                         border border-green-500/20 px-2 py-0.5 rounded-full text-xs font-medium">
          {isHot ? '🔥 HOT' : 'NEW'}
        </span>
      )}
      
      {/* ... rest of card */}
      
      <div className="flex items-center gap-2 mt-4 text-xs text-zinc-500">
        <ClockIcon className="w-3.5 h-3.5" />
        <span>Posted {formatRelativeTime(job.postedAt)}</span>
      </div>
    </article>
  );
}
```

## 25.4 Homepage Stats Bar (Real-Time Updates)
```tsx
// components/StatsBar.tsx
export function StatsBar() {
  const stats = useRealtimeStats(); // Updates every 5 minutes
  
  return (
    <div className="grid grid-cols-4 gap-4 py-8">
      <Stat
        value={stats.totalJobs.toLocaleString()}
        label="$100k+ Jobs"
        trend={`+${stats.newThisWeek} this week`}
        trendUp={true}
      />
      <Stat
        value={stats.companies.toLocaleString()}
        label="Companies"
        subtext="Actively hiring"
      />
      <Stat
        value={`$${Math.round(stats.avgSalary / 1000)}k`}
        label="Avg. Salary"
      />
      <Stat
        value="Updated 2 min ago"
        label="Data Freshness"
        highlight={true}
      />
    </div>
  );
}
```

═══════════════════════════════════════════════════════════════════════════════
    26. PUBLISHING SAFETY & GOOGLE PENALTY PREVENTION - CRITICAL
═══════════════════════════════════════════════════════════════════════════════

## 26.1 Publishing Configuration (MANDATORY)

**Environment Variables:**
```bash
# Master kill switch - MUST be false until Week 3
PSEO_ENABLED=false

# Domain age tracking (update weekly)
DOMAIN_AGE_WEEKS=1

# First publishing date (Week 3 start)
PUBLISHING_START_DATE=2025-12-27

# Site URL (for canonical/schemas)
NEXT_PUBLIC_SITE_URL=https://www.6figjobs.com

# Cron secret for scheduled jobs
CRON_SECRET=6fjbs_cron_2025_secure_key_abc123xyz789_prod

# Node environment
NODE_ENV=production
```

## 26.2 Publishing Rate Limits (Based on Domain Age)

**CRITICAL:** Domain launched Dec 5, 2025. Publishing starts Week 3 (Dec 27).

| Domain Age | Daily Max | Weekly Max | Min Jobs/Page | Status |
|------------|-----------|------------|---------------|--------|
| Week 1-2   | 0         | 0          | N/A           | ❌ NO PUBLISHING - Monitoring only |
| Week 3-4   | 2         | 10         | 100+          | 🟡 Ultra-conservative |
| Week 5-8   | 5         | 25         | 50+           | 🟡 Conservative |
| Week 9-12  | 10        | 50         | 30+           | 🟢 Moderate |
| Month 4+   | 20        | 100        | 20+           | 🟢 Normal |

**Implementation:** See `scripts/publish-pseo-batch.ts` for rate limit enforcement.

## 26.3 Quality Gates (MANDATORY CHECKS)

**Every page MUST pass ALL gates before publishing:**

### Required Checks
```typescript
interface QualityGate {
  // Content Quality
  minJobs: number;           // Week 3-4: 100+, Week 5+: 50+
  minContentLength: number;  // 200+ chars unique content
  
  // SEO Requirements
  hasH1WithKeyword: boolean; // Must include "$100k" or "high paying"
  hasMetadata: boolean;      // Title (<60 chars), description (<160 chars), canonical
  schemaCount: number;       // Minimum 3 schemas (ItemList, Breadcrumb, FAQ)
  
  // User Experience
  internalLinks: number;     // Minimum 5 internal links
  hasTimestamp: boolean;     // "Updated X ago" visible
  hasNewJobsCounter: boolean; // "X new jobs this week" visible
  
  // Performance
  pageLoadTime: number;      // <2.5s LCP target
}
```

### Auto-Skip Logic
```typescript
// scripts/publish-pseo-batch.ts

function validatePageQuality(page: any): { valid: boolean; reason?: string } {
  // 1. Minimum job count (varies by week)
  const minJobs = domainAgeWeeks <= 4 ? 100 : domainAgeWeeks <= 8 ? 50 : 30;
  if (page.jobCount < minJobs) {
    return { valid: false, reason: `Only ${page.jobCount} jobs (min ${minJobs})` };
  }
  
  // 2. Content length
  const contentLength = page.title.length + page.description.length;
  if (contentLength < 200) {
    return { valid: false, reason: `Content too short: ${contentLength} chars` };
  }
  
  // 3. Has metadata
  if (!page.title || !page.description || !page.canonical) {
    return { valid: false, reason: 'Missing metadata' };
  }
  
  // 4. Has schemas (minimum 3)
  const schemaCount = (page.schemas || []).length;
  if (schemaCount < 3) {
    return { valid: false, reason: `Only ${schemaCount} schemas (min 3)` };
  }
  
  // 5. Has H1 with keyword
  const hasKeyword = page.h1?.toLowerCase().includes('$100k') || 
                     page.h1?.toLowerCase().includes('high paying');
  if (!hasKeyword) {
    return { valid: false, reason: 'H1 missing "$100k" or "high paying"' };
  }
  
  return { valid: true };
}
```

## 26.4 Red Flags - STOP PUBLISHING

**CRITICAL (Auto-disable publishing):**
- 🚨 Google Search Console manual action detected
- 🚨 GSC coverage drops >10% in one week
- 🚨 Index bloat: indexed pages > 2x published pages
- 🚨 Average position drops >20 positions

**WARNINGS (Review but continue):**
- ⚠️ GSC coverage below 70%
- ⚠️ Average jobs per page <15
- ⚠️ Page load time >3s
- ⚠️ Over weekly publishing limit

**Response Procedures:**
1. If CRITICAL flag triggered → Set `PSEO_ENABLED=false` immediately
2. Alert team via Slack/email
3. Follow rollback plan in `docs/ROLLBACK-PLAN.md`
4. Do NOT resume publishing until GSC clears issue

## 26.5 Success Criteria by Week

| Week | Pages Total | Min GSC Indexed | Coverage % | Avg Jobs/Page | Action |
|------|-------------|-----------------|------------|---------------|--------|
| 1-2  | 0           | 0               | N/A        | N/A           | Monitor only |
| 3-4  | 20          | 15              | 75%        | 100+          | Ultra-conservative |
| 5-8  | 100         | 80              | 80%        | 50+           | Conservative |
| 9-12 | 220         | 180             | 82%        | 35+           | Moderate |
| 16+  | 320         | 260             | 80%        | 30+           | Normal |

**Weekly Monitoring Checklist:**
- [ ] Check GSC for manual actions
- [ ] Review coverage percentage
- [ ] Calculate avg jobs per published page
- [ ] Update DOMAIN_AGE_WEEKS
- [ ] Verify publishing rates within limits
- [ ] Review page quality scores
- [ ] Check Core Web Vitals

## 26.6 Rollback Plan Reference

**Location:** `docs/ROLLBACK-PLAN.md`

**Trigger Conditions:**
- Any GSC manual action
- Coverage drop >10% in one week
- Index bloat (indexed > 2x published)

**Immediate Actions:**
```bash
# Day 1: STOP
export PSEO_ENABLED=false

# Days 2-7: Damage Control
node scripts/emergency-noindex.ts --threshold=10
node scripts/rebuild-sitemap.ts --min-jobs=10

# Weeks 2-4: Wait for GSC response
# Week 5+: Restart with doubled minimums
```

## 26.7 Publishing Workflow

**Daily Publishing Routine:**
```bash
# Morning (6 AM UTC)
npm run scrape:all              # Refresh job data

# Midday (12 PM UTC) - Publishing window
PSEO_ENABLED=true npm run publish:pseo

# Evening (6 PM UTC)
npm run scrape:all              # Second refresh

# Check logs
npm run publish:pseo --dry-run  # Preview what would publish
```

**Weekly Review (Every Monday):**
```bash
# 1. Update domain age
# In .env or Railway:
DOMAIN_AGE_WEEKS=2  # Increment weekly

# 2. Review GSC
# Visit: https://search.google.com/search-console
# Check: Coverage, Performance, Manual Actions

# 3. Adjust publishing rate if needed
# Based on coverage % and manual review

# 4. Update team
# Share: Pages published, coverage %, issues found
```

## 26.8 Troubleshooting

**Problem:** Publishing script says "Daily limit reached" but we haven't published today
**Solution:** Check `PUBLISHING_START_DATE` - tracking may be using wrong date range

**Problem:** Pages have enough jobs but aren't publishing
**Solution:** Run `npm run publish:pseo --dry-run --verbose` to see validation failures

**Problem:** GSC shows low coverage (<50%)
**Solution:** 
1. Verify pages are in sitemap
2. Check for noindex tags (staging mode)
3. Review page quality (may need more content)
4. Request reindexing in GSC

**Problem:** Too many pages indexed (>2x published)
**Solution:** Google is over-indexing. Add stricter noindex rules or remove thin pages.

═══════════════════════════════════════════════════════════════════════════════
                     27. QUICK REFERENCE
═══════════════════════════════════════════════════════════════════════════════

**pSEO Routes:**
```
/jobs/state/[state]           → 50 state pages
/jobs/skills/[skill]          → 30 skill pages
/jobs/industry/[industry]     → 10 industry pages
/jobs/city/[city]             → 19 city pages
/jobs/[role]/remote           → role + remote combos
/jobs/[role]/[city]           → role + city combos
/jobs/[role]/skills/[skill]   → role + skill combos
/jobs/skills/[skill]/remote   → skill + remote combos
```

**H1 Patterns:**
```
Role:     "[COUNT] $100k+ [Role] Jobs"
State:    "[COUNT] $100k+ Jobs in [State]"
City:     "[COUNT] $100k+ Jobs in [City]"
Skill:    "[COUNT] $100k+ [Skill] Jobs"
Combo:    "[COUNT] Remote [Role] $100k+ Jobs"
Salary:   "$100k+ [Role] Salaries in [Location]"
```

**Required Schemas:**
```
Listings: ItemList + BreadcrumbList + FAQPage
Details:  JobPosting + BreadcrumbList
Company:  Organization + ItemList
Salary:   Occupation + FAQPage + BreadcrumbList
```

**Railway Commands:**
```bash
railway login          # Login to Railway
railway link           # Link to project
railway logs           # View logs
railway run <cmd>      # Run command in prod
git push origin main   # Auto-deploy
```

**Keyword Density:**
```
"$100k": 5-7 per 500 words
"high paying": 3-4 per 500 words
"six figure": 2-3 per 500 words
```
