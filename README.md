# 6figjobs — Six Figure Jobs Board

High-signal job board focused on verified $100k+ roles, built with strict SEO, data-quality, and audit-first principles.

This repository is intentionally opinionated:
- Data correctness > volume
- SEO stability > experimentation
- Audit before change
- AI assists, never invents

---

## Project Mission

Surface legitimate, high-paying jobs without:
- index bloat
- salary lies
- duplicate content
- scraper spam

Every job shown must earn its place.

---

## High-Level Architecture

Scrapers / ATS / Boards
-> Normalization + Dedupe
-> Salary and Location Validation
-> Prisma (Postgres)
-> Slices and pSEO Pages
-> Next.js App Router

---

## Repository Structure

app/                Next.js App Router  
components/         Shared UI components  
middleware.ts       Edge routing and SEO safeguards  

lib/                Core business logic  
lib/scrapers/       ATS and board scrapers  
lib/ingest/         Ingest orchestration  
lib/normalizers/    Salary, location, role normalization  
lib/jobs/           Job querying and rules  
lib/seo/            Canonicals, meta, JSON-LD  
lib/slices/         pSEO slice engine  

prisma/             Schema and migrations  
scripts/            Scrapes, audits, backfills  
logs/               Scrape and QA logs  

docs/               Canonical specifications  
ai-dev-tasks/6figjobs/  AI governance and audit system  

---

## Canonical Documentation Order

1. docs/PROJECT_OS.md
2. docs/SEO_SPEC.md
3. docs/ARCHITECTURE_SPEC.md
4. docs/DATA_INGEST_SPEC.md
5. docs/DESIGN_UX_SPEC.md
6. docs/RELEASE_QA_SPEC.md
7. docs/ROLLBACK-PLAN.md

If documents conflict, follow this order.

---

## AI and Agent Rules

Before any change:
1. Read ai-dev-tasks/6figjobs/00_REPO_TRUTH.md
2. Run ai-dev-tasks/6figjobs/00_AUDIT_FIRST_NO_DUPES.md
3. Prove whether the feature already exists
4. Stop and wait for approval

AI must:
- cite file paths
- quote code
- mark UNKNOWN if unsure
- never hallucinate behavior

---

## Scrapers and Data Rules

- ATS > boards > generic scrapes
- Companies must be deduplicated
- Salary must be validated before display
- AI-derived data is never authoritative

Key rules:
- ai-dev-tasks/6figjobs/02_REQUIRED_JOB_FIELDS.md
- ai-dev-tasks/6figjobs/10_SCRAPERS_AUDIT.md
- ai-dev-tasks/6figjobs/12_SCRAPER_RUN_GROWTH_PROTOCOL.md

---

## Company Discovery System

Six Figure Jobs uses a two-phase approach to job aggregation:

### Phase 1: Company Discovery

Board scrapers (Remotive, WeWorkRemotely, etc.) extract job listings and discover company ATS URLs.

Discovered companies stored in `CompanyATS` table with:
- Company name and slug
- ATS type (Greenhouse, Lever, Ashby, etc.)
- ATS URL for direct scraping
- Discovery source (which board found it)

### Phase 2: Direct ATS Scraping

`scrapeDirectATS.ts` script scrapes companies directly from their ATS, bypassing job boards entirely.

**Benefits:**
- Higher job volume per company (boards show 1-2 jobs, ATS has 10-50)
- Better data quality (direct from source)
- Fewer duplicates
- More sustainable (less board scraper maintenance)

**Current Status:** 17+ companies discovered, scraped via `scrapeDirectATS.ts`.

---

## Known Limitations

### WeWorkRemotely Cloudflare Protection

WeWorkRemotely blocks automated extraction of final application URLs using Cloudflare "Just a moment..." challenge pages.

**Current Status:** WeWorkRemotely jobs are ingested, but apply URLs remain board URLs.

**Impact:** Users click through WeWorkRemotely before reaching the company site.

**Future Solutions:**
- Partnership with WeWorkRemotely
- Browser automation (Playwright/Puppeteer) with challenge handling
- Skip WeWorkRemotely for CompanyATS discovery

Last investigated: January 2026

---

## Change Gates

Any change touching:
- SEO, slugs, sitemaps
- scrapers
- Prisma schema
- job cards or listings

Must pass docs/CHANGE_GATES.md

---

## Changelog Policy

CHANGELOG.md           Human curated  
CHANGELOG.generated.md Auto generated from commits  

---

## Common Commands

npm install
npm run dev

Scrape:
npm run ts-node scripts/dailyScrapeV2.ts

Audit:
npm run ts-node scripts/qaScrapers.ts
npm run ts-node scripts/audit-v2.9.ts

---

## Final Rule

If unsure:
stop
audit
ask

This project optimizes for long-term trust, not speed.
