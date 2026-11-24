// lib/seo/sitemapWaves.ts
//
// Staged sitemap rollout for the new domain (owner's plan, 2026-11-22). The old domain had 2 of 270 inspected pages
// indexed, so the new one submits a few pages first and adds the next wave only once Search Console shows most of the
// current one indexed. Raise `SITEMAP_WAVE` in Openship (Apply environment; no deploy) to add the next wave.
//
//   1  home, /jobs, /remote, /companies, /salary, /high-paying-jobs, /high-paying-jobs-report, /blog (index only),
//      /privacy, /terms, /about, /post-a-job
//   2  + salary bands (/jobs/100k-plus … /400k-plus) and the blog articles
//   3  + the Phase 1 role hubs (/jobs/<role>) and the country pages
//   4  + salary guides (/salary/<role>), remote role pages, /remote/companies, /jobs/no-degree, /jobs/4-day-week and
//      the pay report's method page and older editions (everything else the hubs sitemap lists)
//   5  + pSEO batch 1 and the 25 best company pages
//   6+ + pSEO batch 2, 3, 4 (wave n releases batch n - 4, never past PSEO_RELEASED_BATCH / PSEO_BATCH_SCHEDULE), and
//      more company pages: 50, 100, 200 (getCompanyReleaseLimit)
//
// Waves 1-4 decide only what the sitemap submits: those pages stay indexable before their wave. The long-tail pages
// (pSEO batches, company pages) also stay `noindex, follow` until wave 5+, as unreleased batches always have.

export const SITEMAP_WAVE_COUNT = 8

/** What each wave adds to the sitemap, in words, for the admin console (index = wave; the list above in short). */
export const SITEMAP_WAVE_ADDS = [
  '',
  'home and core pages',
  'salary bands and blog articles',
  'role hubs and country pages',
  'salary guides, remote role pages and the other hubs',
  'pSEO batch 1 and the 25 best company pages',
  'pSEO batch 2 and up to 50 company pages',
  'pSEO batch 3 and up to 100 company pages',
  'pSEO batch 4 and up to 200 company pages',
] as const

export const SALARY_BANDS_WAVE = 2
export const COUNTRY_WAVE = 3
export const LONG_TAIL_WAVE = 5

/** The current wave, from `SITEMAP_WAVE` (default 1, clamped to 1..SITEMAP_WAVE_COUNT). Read at call time. */
export function getSitemapWave(): number {
  const n = Number.parseInt(process.env.SITEMAP_WAVE ?? '1', 10)
  if (!Number.isFinite(n)) return 1
  return Math.min(SITEMAP_WAVE_COUNT, Math.max(1, n))
}

const WAVE_1_PATHS = new Set([
  '/',
  '/jobs',
  '/remote',
  '/companies',
  '/salary',
  '/high-paying-jobs',
  '/high-paying-jobs-report',
  '/blog',
  '/privacy',
  '/terms',
  '/about',
  '/post-a-job',
])

const NOT_ROLE_HUBS = new Set(['/jobs/no-degree', '/jobs/4-day-week'])

/** The wave a page from the hubs sitemap (lib/seo/evergreenSitemap.ts) is first submitted in. */
export function getHubPathWave(path: string): number {
  if (WAVE_1_PATHS.has(path)) return 1
  if (path.startsWith('/blog/')) return 2
  if (/^\/jobs\/[^/]+$/.test(path) && !NOT_ROLE_HUBS.has(path)) return 3
  return 4
}

export function isHubPathInWave(path: string, wave: number = getSitemapWave()): boolean {
  return getHubPathWave(path) <= wave
}

/** Highest pSEO batch the current wave allows: none before LONG_TAIL_WAVE, then one more per wave. */
export function getPseoBatchCapForWave(wave: number = getSitemapWave()): number {
  return Math.max(0, wave - (LONG_TAIL_WAVE - 1))
}

/** Company pages may be indexed and submitted only from LONG_TAIL_WAVE. */
export function areCompanyPagesReleased(wave: number = getSitemapWave()): boolean {
  return wave >= LONG_TAIL_WAVE
}

// How many company pages each wave releases (owner's request, 2026-11-24). The drip in lib/seo/companyPublishing.ts
// counts 5 every 3 days from 2026-06-04, about 290 by wave 5, which would all have gone live and into the sitemap at
// once. Google does not publish a safe rate; this keeps each step near the size of waves 2-4 (10-23 pages).
const COMPANY_RELEASE_BY_WAVE: Record<number, number> = { 5: 25, 6: 50, 7: 100, 8: 200 }

/**
 * The most company pages released now (the best-ranked first, lib/seo/companyPublishing.ts): the wave's number, or
 * `COMPANY_RELEASE_LIMIT` (Openship env, a whole number >= 0) from wave 5 when it is set. Unlimited before wave 5,
 * where company pages are noindex anyway and the drip alone orders the homepage and /companies lists as before.
 */
export function getCompanyReleaseLimit(
  wave: number = getSitemapWave(),
  override: string | undefined = process.env.COMPANY_RELEASE_LIMIT,
): number {
  if (wave < LONG_TAIL_WAVE) return Infinity
  const n = /^\s*\d+\s*$/.test(override ?? '') ? Number.parseInt(String(override), 10) : NaN
  if (Number.isFinite(n)) return n
  return COMPANY_RELEASE_BY_WAVE[Math.min(wave, SITEMAP_WAVE_COUNT)] ?? Infinity
}
