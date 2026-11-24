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
//   5  + pSEO batch 1 and the company pages
//   6+ + pSEO batch 2, 3, 4 (wave n releases batch n - 4, never past PSEO_RELEASED_BATCH / PSEO_BATCH_SCHEDULE)
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
  'pSEO batch 1 and company pages',
  'pSEO batch 2',
  'pSEO batch 3',
  'pSEO batch 4',
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
