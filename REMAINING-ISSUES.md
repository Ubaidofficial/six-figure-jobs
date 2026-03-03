# Remaining Critical Issues - Six Figure Jobs

## 1. Double Flag Display (URGENT)
**Status:** Needs fix in JobCard component
**Issue:** Shows "🇺🇸 🇺🇸 USA" instead of "🇺🇸 USA"
**Root Cause:** buildLocationDisplay shows flag emoji AND country code
**Fix Required:** Only show flag + city OR flag + country, not both

## 2. Missing Job Descriptions (HIGH PRIORITY)
**Status:** No descriptions on cards or detail pages
**Issue:** Cards show no snippets, detail pages show generic "sourced from ATS" text
**Data:** Only 480/879 jobs have aiSnippet
**Fix Required:** 
- Scrape full descriptions from ATS sources
- Use descriptionHtml field (currently has salary info, not description)
- Generate better aiSnippets for jobs that don't have them

## 3. Wrong Apply URLs (HIGH PRIORITY)
**Issue:** Links go through aggregators (remote100k ref links) instead of direct ATS
**Example:** Should be `greenhouse.io/chainguard/jobs/4614343006`
**Fix Required:**
- Extract canonical ATS URLs during scraping
- Update applyUrl to point directly to employer ATS
- Store aggregator as source for attribution only

## 4. Missing Tech Stack (MEDIUM)
**Status:** 0/879 jobs have techStack or skillsJson
**Fix Required:**
- Extract from job descriptions using AI/pattern matching
- Scrape from structured data in ATS feeds
- Parse from RemoteRocketship-style tags

## 5. Missing Company Info
**Needed:** Company size, industry, benefits
**Current:** Some jobs missing this data
**Fix Required:** Enrich from company profiles and job descriptions

## Next Steps:
1. Fix double flag in JobCard (quick fix)
2. Scrape job descriptions from ATS sources
3. Fix apply URLs to point directly to ATS
4. Extract tech stack from descriptions
5. Enrich company metadata
