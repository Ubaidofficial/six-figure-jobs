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

export function getSeoPhase(): number {
  return Number.parseInt(process.env.SEO_INDEXATION_PHASE || '1', 10)
}

export function shouldAdvertiseSitemapFamily(family: CoreSitemapFamily): boolean {
  const phase = getSeoPhase()
  const p1 = new Set(['jobs', 'company', 'remote', 'blog', 'browse'])
  const p2 = new Set(['city', 'country', 'category', 'level', 'salary'])
  const p3 = new Set(['slices', 'skills'])
  
  if (p1.has(family)) return phase >= 1
  if (p2.has(family)) return phase >= 2
  if (p3.has(family)) return phase >= 3
  
  return true // default fallback
}

export function getMaxJobSitemapShards(): number {
  return readPositiveInt(
    process.env.SEO_CORE_JOB_SITEMAP_SHARDS,
    getSeoPhase() <= 1 ? 1 : 5000,
  )
}

export function getMaxJobUrlsPerShard(): number {
  return readPositiveInt(
    process.env.SEO_CORE_JOB_URLS_PER_SHARD,
    getSeoPhase() <= 1 ? 20000 : 20000,
  )
}

export function getMaxCompanySitemapPages(): number {
  return readPositiveInt(
    process.env.SEO_CORE_COMPANY_SITEMAP_PAGES,
    getSeoPhase() <= 1 ? 1 : 10000,
  )
}

export function getMaxCompanyUrlsPerPage(): number {
  return readPositiveInt(
    process.env.SEO_CORE_COMPANY_URLS_PER_PAGE,
    getSeoPhase() <= 1 ? 500 : 45000,
  )
}

export function getMaxRemoteSitemapUrls(): number {
  return readPositiveInt(
    process.env.SEO_CORE_REMOTE_SITEMAP_URLS,
    getSeoPhase() <= 1 ? 100 : 100000,
  )
}
