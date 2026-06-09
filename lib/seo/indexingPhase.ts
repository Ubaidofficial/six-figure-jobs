// lib/seo/indexingPhase.ts
//
// Phased indexing rollout for a low-authority site.
//
// Context: only the homepage was indexed despite Google crawling ~20k URLs.
// The unindexed pages weren't broken — Google's algorithm just doesn't trust
// the site to absorb that many URLs yet. Adding more crawlable pages makes
// the "Crawled - currently not indexed" bucket worse, not better.
//
// Strategy: ship URLs to Google in tiers. Phase 1 = ~50 hand-picked pages.
// Once GSC confirms most are indexed, bump INDEXING_PHASE to 2 and unlock
// the next tier. Every sitemap + page metadata consults this module to
// decide what's discoverable.
//
// Env var: `INDEXING_PHASE` (default 1). Set to 2 or 3 to expand.

export type IndexingPhase = 1 | 2 | 3

function readPhaseFromEnv(): IndexingPhase {
  const raw = process.env.INDEXING_PHASE
  if (!raw) return 1
  const n = Number(raw)
  if (n === 2) return 2
  if (n === 3) return 3
  return 1
}

let cachedPhase: IndexingPhase | null = null

export function getIndexingPhase(): IndexingPhase {
  if (cachedPhase != null) return cachedPhase
  cachedPhase = readPhaseFromEnv()
  return cachedPhase
}

// Resets the cache. Tests only — production reads from env once per boot.
export function __resetIndexingPhaseCacheForTests(): void {
  cachedPhase = null
}

export function isPhase1(): boolean {
  return getIndexingPhase() === 1
}

export function isPhase2OrLater(): boolean {
  return getIndexingPhase() >= 2
}

export function isPhase3OrLater(): boolean {
  return getIndexingPhase() >= 3
}

// ─── Phase 1 allowlists ──────────────────────────────────────────────────────
//
// Hand-curated for the foundation phase. Quality over quantity — these are the
// pages with the most unique content, internal links, and highest job counts.

// Top tech role slugs that have the most jobs + best-quality salary data.
// Aligns with the lib/roles canonical slug set.
export const PHASE_1_ROLE_SLUGS = new Set<string>([
  'software-engineer',
  'backend-engineer',
  'frontend-engineer',
  'full-stack-engineer',
  'data-engineer',
  'data-scientist',
  'machine-learning-engineer',
  'devops-engineer',
  'product-manager',
  'engineering-manager',
])

// Top country codes (ISO-2) where we have meaningful job volume.
export const PHASE_1_COUNTRY_CODES = new Set<string>(['US', 'GB', 'CA', 'DE', 'AU'])

// Pillar hub paths that should always be indexable, regardless of phase.
// These are the entry points that funnel crawl budget into the rest of the site.
export const ALWAYS_INDEXABLE_HUBS = new Set<string>([
  '/',
  '/jobs',
  '/companies',
  '/salary',
  '/remote',
])

// Sitemap families that ship URLs in Phase 1. Families NOT in this set should
// return an empty <urlset> (still 200 OK so Google doesn't error, but no URLs
// to crawl).
//
// Why this list:
//   - Hubs are the four pillar URLs (handled inline, no family).
//   - sitemap-jobs ships ONLY the freshest jobs (we still want Google Jobs
//     surfaces, and individual job pages have the strongest unique content).
//     The sitemap itself is the family — the route caps & gates inside.
//   - sitemap-salary ships salary-tier hubs (/jobs/100k-plus etc.), which are
//     already gated at 5 jobs.
//   - sitemap-company ships only the manifest-unlocked companies (already
//     drip-released by the companyPublishing manifest).
//
// Everything else (city, country, level, skills, remote, browse, category,
// blog, slices, etc.) is silenced in Phase 1.
export const PHASE_1_ENABLED_SITEMAP_FAMILIES = new Set<string>([
  'sitemap-jobs',
  'sitemap-company',
  'sitemap-salary',
])

/**
 * Returns true if a sitemap family should ship URLs in the current phase.
 * Use inside each `app/sitemap-<family>.xml/route.ts` GET handler to early-
 * return an empty urlset when the family is silenced.
 */
export function isSitemapFamilyEnabled(family: string): boolean {
  if (isPhase2OrLater()) return true
  return PHASE_1_ENABLED_SITEMAP_FAMILIES.has(family)
}

/**
 * 200 OK empty <urlset> with a meta comment explaining the silencing. We
 * return 200 (not 404) so Google's sitemap fetcher doesn't flag the family as
 * broken — just sees zero URLs to crawl. Each route calls this when its family
 * is silenced by the current phase.
 */
export function buildPhase1SilencedSitemapResponse(family: string): Response {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- ${family} silenced by INDEXING_PHASE=${getIndexingPhase()} — bump to 2 to re-enable -->
</urlset>`
  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=600',
      'X-Indexing-Phase': String(getIndexingPhase()),
      'X-Indexing-Phase-Silenced': '1',
    },
  })
}

export type IndexabilityContext = {
  roleSlug?: string | null
  countryCode?: string | null
  pathname?: string | null
}

/**
 * Phase-aware indexability override. Page-level `generateMetadata` should call
 * this last, after its own family-specific gate (e.g. min-job-count) has
 * passed. If it returns false, set robots: { index: false, follow: true }.
 *
 * The intent is "I'd otherwise be indexable, BUT the rollout phase hasn't
 * unlocked my page type yet." In Phase 2+ this always returns true.
 */
export function isPhaseIndexable(ctx: IndexabilityContext): boolean {
  if (isPhase2OrLater()) return true

  const pathname = String(ctx.pathname || '').trim()
  if (pathname && ALWAYS_INDEXABLE_HUBS.has(pathname)) return true

  const roleSlug = String(ctx.roleSlug || '').toLowerCase().trim()
  const countryCode = String(ctx.countryCode || '').toUpperCase().trim()

  // Salary guides for top roles (no country = the broad guide)
  if (roleSlug && PHASE_1_ROLE_SLUGS.has(roleSlug) && !countryCode) {
    return true
  }

  // Role × country only if BOTH are in the allowlist
  if (
    roleSlug &&
    PHASE_1_ROLE_SLUGS.has(roleSlug) &&
    countryCode &&
    PHASE_1_COUNTRY_CODES.has(countryCode)
  ) {
    return true
  }

  return false
}
