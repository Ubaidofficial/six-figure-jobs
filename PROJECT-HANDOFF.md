# Six Figure Jobs - Project Handoff Document

## Project Overview
Premium job board for $100k+ remote/hybrid positions. Built with Next.js 16, Prisma, PostgreSQL on Railway.
- **Live Site:** https://6figjobs.com
- **Current Status:** ~55% complete, 879 active jobs from 2.6k companies
- **Deployment:** Railway on `develop` branch (auto-deploys on push)

## Recent Fixes Completed ✅

### 1. Location Data Migration (Dec 28, 2024)
- **Added fields:** `primaryLocation` (string), `locationsJson` (JSON array)
- **Migration:** Parsed `locationRaw` to extract clean city/country data
- **Script:** `scripts/fix-location-v2.ts` - handles "Remote-Friendly (Travel-Required)" prefixes
- **Status:** All 879 active jobs migrated successfully

### 2. JobCard Component Enhancement
- **Files Updated:**
  - `components/jobs/JobCard.tsx` (main JobCard - used by most pages)
  - `app/components/JobCard.tsx` (legacy - only used by InfiniteJobsList)
- **Changes:**
  - Added support for `primaryLocation` and `locationsJson` fields
  - Multi-location indicator shows "+N" when job has multiple cities
  - Prioritizes `aiSnippet` over generic descriptions
  - Supports both `techStack` and `skillsJson` fields

### 3. Data Quality Improvements
- Fixed location parsing bugs (removed "Hybrid -", "Remote -" prefixes)
- Proper US state code detection (NY, CA, TX, etc.)
- Extracted city and countryCode from locationRaw
- Created clean locationsJson array for multi-location jobs

## Project Structure

### Key Directories
```
six-figure-jobs/
├── app/                          # Next.js 16 app directory
│   ├── components/               # Legacy components
│   │   └── JobCard.tsx          # Old JobCard (only used by InfiniteJobsList)
│   ├── page.tsx                 # Homepage
│   ├── jobs/                    # Job listing pages
│   │   ├── [role]/page.tsx      # Role-based pages (/jobs/software-engineer)
│   │   └── location/            # Location pages
│   ├── remote/                  # Remote jobs section
│   │   ├── page.tsx             # Remote jobs hub
│   │   └── [role]/page.tsx      # Remote role pages
│   └── job/[slug]/page.tsx      # Individual job detail pages
├── components/                   # Main components directory
│   └── jobs/
│       ├── JobCard.tsx          # MAIN JobCard component (use this one!)
│       ├── JobCard.module.css   # Styles for JobCard
│       └── JobList.tsx          # Renders list of JobCards
├── lib/                         # Business logic
│   ├── jobs/
│   │   ├── queryJobs.ts         # Main job query function
│   │   ├── jobSlug.ts           # URL generation
│   │   └── salary.ts            # Salary formatting
│   ├── scrapers/                # Job scrapers
│   │   ├── greenhouse.ts        # ATS scraper
│   │   └── remoteyeah.ts        # Job board scraper
│   └── prisma.ts                # Prisma client
├── prisma/
│   └── schema.prisma            # Database schema
└── scripts/                     # Utility scripts
    ├── fix-location-v2.ts       # Latest location fix script
    └── migrate-location-data-active-only.ts
```

### Database Schema (Key Fields)
```prisma
model Job {
  id                String
  title             String
  company           String
  locationRaw       String?        // Original location text
  primaryLocation   String?        // ✅ NEW: Clean primary location
  locationsJson     Json?          // ✅ NEW: Array of location objects
  city              String?        // Extracted city name
  countryCode       String?        // ISO country code (US, GB, CA, etc.)
  remote            Boolean
  remoteMode        String?        // "remote" | "hybrid" | "onsite"
  
  minAnnual         BigInt?
  maxAnnual         BigInt?
  currency          String?
  salaryValidated   Boolean
  
  descriptionHtml   String?        // ⚠️ Currently has salary info, not description
  aiSnippet         String?        // Short AI-generated summary (480/879 jobs)
  techStack         String?        // ❌ Empty (0/879 jobs)
  skillsJson        String?        // ❌ Empty (0/879 jobs)
  
  applyUrl          String?        // ⚠️ Currently has aggregator URLs
  source            String         // "ats:greenhouse", "board:remote100k", etc.
  
  isExpired         Boolean
  createdAt         DateTime
}
```

### Component Architecture

**JobList Component** (`app/components/JobList.tsx`)
- Imports from: `@/components/jobs/JobCard` ← This is the MAIN one
- Used by: All job listing pages, remote pages, search pages

**Main JobCard** (`components/jobs/JobCard.tsx`)
- Modern design with Lucide icons
- Displays: logo, title, salary, location, work type, seniority, skills
- Handles `primaryLocation` and `locationsJson`
- Uses `buildLocationDisplay()` function for location logic

**Legacy JobCard** (`app/components/JobCard.tsx`)
- Only used by `InfiniteJobsList` (infinite scroll component)
- Can be ignored for most fixes

### Key Functions

**queryJobs()** - `lib/jobs/queryJobs.ts`
```typescript
// Main job query function
// Returns JobWithCompany[] with all fields via Prisma include
await queryJobs({
  page: 1,
  pageSize: 20,
  sortBy: 'date' | 'salary',
  isHundredKLocal: true,
  remoteOnly?: boolean,
  roleSlugs?: string[]
})
```

**buildLocationDisplay()** - `components/jobs/JobCard.tsx`
```typescript
// Builds location label for job cards
// Returns: { label: string, hasMultiple: boolean, count: number }
// Issue: Currently shows double flags "🇺🇸 🇺🇸 USA"
```

## Critical Remaining Issues

### 1. Double Flag Display 🔴 URGENT
**Location:** `components/jobs/JobCard.tsx` - `buildLocationDisplay()` function
**Problem:** Shows "🇺🇸 🇺🇸 USA" instead of "🇺🇸 USA"
**Why:** Function calls `countryFlag(cc)` to get emoji, then displays `${flag} ${cc}`, but when `primaryLocation` is "USA", it shows emoji + "USA" + cc which is also "USA"
**Expected:** "🇺🇸 New York" or "🇺🇸 USA" (not both)

### 2. Missing Job Descriptions 🔴 HIGH
**Problem:** 
- Job cards show no description snippets
- Detail pages show generic "sourced from ATS" text
- Only 480/879 jobs have `aiSnippet`
**Data Issues:**
- `descriptionHtml` contains salary parsing text, not actual job description
- Need to scrape full descriptions from ATS sources
**Fix Needed:**
- Scrape job descriptions from Greenhouse/Lever/other ATS
- Store in proper field
- Generate aiSnippets for remaining jobs

### 3. Wrong Apply URLs 🔴 HIGH
**Problem:** Apply URLs point to aggregators (e.g., `remote100k.com/?ref=...`) instead of direct employer ATS
**Example:** Should be `https://job-boards.greenhouse.io/chainguard/jobs/4614343006`
**Current:** `https://remote100k.com/job/4614343006?ref=remote100k`
**Fix Needed:**
- Extract canonical ATS URL during scraping
- Update `applyUrl` to point directly to employer
- Keep aggregator URL only for attribution

### 4. No Tech Stack 🟡 MEDIUM
**Problem:** 0/879 jobs have `techStack` or `skillsJson` populated
**Impact:** Job cards can't show technology tags (competitors show 5-7 tags)
**Fix Needed:**
- Extract from job descriptions using pattern matching
- Scrape from ATS structured data
- Parse from aggregator tags (RemoteRocketship has good tags)

### 5. Missing Company Metadata 🟡 MEDIUM
**Needed:** Company size, industry, benefits
**Current:** Partial data in `companyRef` relation
**Fix Needed:** Enrich from Clearbit/company websites

## Development Workflow

### Local Development
```bash
npm run dev                    # Start dev server on localhost:3000
npx prisma studio              # Open Prisma Studio (DB GUI)
npx tsx scripts/your-script.ts # Run TypeScript scripts
```

### Database Access
```bash
# Railway PostgreSQL credentials in .env
DATABASE_URL="postgresql://..."

# Run queries
npx prisma db pull             # Pull schema from DB
npx prisma generate            # Regenerate Prisma client
```

### Deployment
```bash
git add .
git commit -m "fix: your change"
git push origin develop        # Auto-deploys to Railway
```

### Testing Scripts
```bash
# Check field population
npx tsx scripts/check-new-fields.ts

# Verify location data
npx tsx scripts/check-primary-location-values.ts

# Run location fixes
npx tsx scripts/fix-location-v2.ts
```

## Important Notes

1. **Two JobCard Components:** Always edit `components/jobs/JobCard.tsx` (not the one in `app/components/`)
2. **Active Jobs Filter:** Use `isExpired: false` for all queries
3. **Railway Deployment:** Takes 2-3 minutes, watch build logs
4. **Database Changes:** Always run migration scripts on active jobs only
5. **Prisma Client:** Run `npx prisma generate` after schema changes

## Data Quality Standards
- ✅ 879 active jobs with 100% salary validation
- ✅ All jobs have `primaryLocation` and `locationsJson`
- ✅ PPP-adjusted thresholds (£80k UK, €90k Germany, $150k Australia)
- ❌ Only 55% have `aiSnippet`
- ❌ 0% have `techStack`
- ❌ Apply URLs point to aggregators instead of ATS

## Competitor Analysis
Users compare us to:
- **Remote Rocketship** - Data-rich cards with company size, industry tags
- **Remote100K** - Clean salary focus, simple cards
- **RemoteYeah** - Tech stack heavy, bright green branding (similar to ours)

Our advantage: Verified salaries, PPP-adjusted thresholds, no entry-level noise.

## Next Engineer: Start Here
1. Read `REMAINING-ISSUES.md` for detailed issue breakdown
2. Fix double flag issue in `components/jobs/JobCard.tsx`
3. Scrape job descriptions from ATS sources
4. Update apply URLs to point directly to employers
5. Test locally, commit to `develop`, verify on production

Good luck! 🚀
