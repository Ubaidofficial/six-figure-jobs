# GSC Indexing Triage — 6figjobs

Purpose: turn Google Search Console (GSC) indexing reports into an audit-friendly, non-hallucinatory workflow.
This file does NOT prescribe fixes. It defines classification + evidence requirements.

Rule: Do not treat "not indexed" counts as automatically bad. For pSEO sites, many "not indexed" URLs are intentional.

---

## Triage Categories (GSC → Action)

### 1) Page with redirect
Default classification: EXPECTED

Common legitimate causes in this repo:
- Slug normalization (old job slug → canonical slug)
- ShortId migration redirects
- Consolidation of legacy routes to new routes

Audit requirements:
- Confirm redirects are single-hop (no chains)
- Confirm redirect targets are canonical URLs
- Confirm redirected URLs are NOT present in sitemaps
- Confirm internal links point to canonical destination (not legacy redirect URL)

Escalate to INVESTIGATE if:
- redirect chains exist
- redirect target is 404 or 5xx
- redirected URLs are still in sitemaps
- canonical tag conflicts with redirect target

---

### 2) Server error (5xx)
Default classification: CRITICAL

Meaning:
- Google could not fetch the page reliably.
- Always a technical issue until proven otherwise.

Audit requirements:
- Collect sample URLs (10–25)
- For each URL, record:
  - route handler / page file (app/…)
  - expected DB queries and known hotspots
  - whether error is reproducible locally or only in production
- Check for:
  - SSR timeouts
  - database connection exhaustion
  - middleware exceptions
  - sitemap routes generating heavy queries
  - invalid params causing crashes

Output requirements:
- A table mapping URL → code path → suspected cause → severity

No "fix" allowed until:
- reproducible evidence exists
- root cause is located in code

---

### 3) Not found (404)
Default classification: MONITOR (can be EXPECTED)

Common legitimate causes:
- Expired jobs removed or hidden
- Old URLs from prior slug strategy
- Bot spam URLs

Audit requirements:
- Confirm 404 URLs are NOT in sitemaps
- Confirm 404 URLs are NOT internally linked
- Confirm server returns real 404 (not soft 404 HTML with 200)

Escalate to INVESTIGATE if:
- sitemap includes 404 URLs
- internal links include 404 URLs
- high 404 rate tied to a recent release

If 404 is intentional:
- keep consistent and stable
- do not redirect everything to homepage

---

### 4) Excluded by 'noindex' tag
Default classification: EXPECTED (if intentional)

Likely intentional surfaces:
- internal search results
- filter permutations
- thin slice pages
- debug pages

Audit requirements:
- Confirm noindex pages are not linked in sitemaps
- Confirm noindex is applied consistently (no accidental noindex on indexable pages)
- Confirm canonical behavior for noindex pages is consistent with policy

Escalate to CRITICAL if:
- core indexable pages are noindexed (jobs, companies, high-value slices)

---

### 5) Alternative page with proper canonical tag
Default classification: HEALTHY / DESIRED

Meaning:
- Google recognizes a canonical URL and collapses duplicates correctly.

Audit requirements:
- Confirm canonical target is correct and indexable
- Confirm canonical target is in sitemap (if it should be indexed)
- Confirm duplicates are not linked internally

Do not attempt to "fix" this unless:
- canonical targets are wrong or non-indexable

---

### 6) Crawled - currently not indexed
Default classification: STRATEGIC (not a technical bug by default)

Meaning:
- Google crawled the page but chose not to index it.

Common causes:
- thin or duplicate content clusters
- low unique value vs other pages
- crawl budget prioritization
- weak internal linking

Audit requirements:
- Sample URLs (25–100)
- For each URL, record:
  - page type (job, company, slice, search, etc.)
  - content uniqueness score (qualitative)
  - internal links to it (where from)
  - canonical and meta index directive
  - whether it's in a sitemap

Escalate to INVESTIGATE if:
- these are high-value pages (jobs, key slices) and content is strong
- sitemap contains large numbers of crawled-not-indexed pages
- internal linking suggests they should be important but Google disagrees

Treat as STRATEGY if:
- pages are low value or redundant
- pages are long-tail experiments
- pages are intentionally lower-priority

---

## Required Evidence Pack (for any indexing discussion)

When reporting GSC issues, always include:
1) Sample URLs (at least 10 per category, more for crawled-not-indexed)
2) Whether those URLs appear in:
   - sitemaps (which sitemap)
   - internal links (where from)
3) For each URL:
   - canonical URL
   - robots meta (index/noindex)
   - HTTP status (200/3xx/4xx/5xx)
4) Route ownership:
   - exact app/ path (page.tsx or route.ts)
   - any middleware interaction

No evidence → classify as UNKNOWN and stop.

---

## Governance Rules

- Do NOT "optimize" indexing by removing noindex rules without approval.
- Do NOT redirect 404 pages to homepage by default.
- Do NOT remove pages from sitemaps without confirming page type + intent.
- 5xx issues take priority over all other indexing work.

---

## Where to Record Outcomes

- If issue is real bug → create PRD using PRD_TEMPLATE.md
- If issue is policy/strategy → document in docs/SEO_SPEC.md or docs/CHANGE_GATES.md
- If issue is outdated GSC noise → record as MONITOR with evidence

