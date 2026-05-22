type CoreSitemapFamily =
  | 'jobs'
  | 'company'
  | 'remote'
  | 'salary'
  | 'blog'
  | 'city'
  | 'country'
  | 'category'
  | 'level'
  | 'browse'
  | 'slices'
  | 'skills'

function readPositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ''), 10)
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback
  return parsed
}

export function isCoreOnlySitemapMode(): boolean {
  return process.env.SEO_CORE_ONLY === '1'
}

export function getCoreOnlyFamilies(): Set<CoreSitemapFamily> {
  return new Set<CoreSitemapFamily>(['jobs', 'company', 'remote', 'salary', 'blog'])
}

export function shouldAdvertiseSitemapFamily(family: CoreSitemapFamily): boolean {
  if (!isCoreOnlySitemapMode()) return true
  return getCoreOnlyFamilies().has(family)
}

export function getMaxJobSitemapShards(): number {
  return readPositiveInt(
    process.env.SEO_CORE_JOB_SITEMAP_SHARDS,
    isCoreOnlySitemapMode() ? 8 : 5000,
  )
}

export function getMaxCompanySitemapPages(): number {
  return readPositiveInt(
    process.env.SEO_CORE_COMPANY_SITEMAP_PAGES,
    isCoreOnlySitemapMode() ? 1 : 10000,
  )
}

export function getMaxRemoteSitemapUrls(): number {
  return readPositiveInt(
    process.env.SEO_CORE_REMOTE_SITEMAP_URLS,
    isCoreOnlySitemapMode() ? 150 : 100000,
  )
}

