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
  const raw = process.env.INDEXING_PHASE || process.env.SEO_INDEXATION_PHASE
  const parsed = Number.parseInt(String(raw || '1'), 10)
  return Number.isFinite(parsed) ? parsed : 1
}

export function shouldAdvertiseSitemapFamily(family: CoreSitemapFamily): boolean {
  const phase = getSeoPhase()
  const p1 = new Set(['jobs', 'company', 'salary'])
  
  if (p1.has(family)) return true
  return phase >= 2
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
