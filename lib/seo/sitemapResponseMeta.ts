import {
  getMaxCompanySitemapPages,
  getMaxCompanyUrlsPerPage,
  getMaxJobSitemapShards,
  getMaxJobUrlsPerShard,
  getMaxRemoteSitemapUrls,
  getSeoPhase,
} from './sitemapPolicy'

type SitemapMeta = {
  generatedAtIso: string
  phase: number
  jobsShards: number
  jobsUrlsPerShard: number
  companyPages: number
  companyUrlsPerPage: number
  remoteUrls: number
}

function readMeta(): SitemapMeta {
  return {
    generatedAtIso: new Date().toISOString(),
    phase: getSeoPhase(),
    jobsShards: getMaxJobSitemapShards(),
    jobsUrlsPerShard: getMaxJobUrlsPerShard(),
    companyPages: getMaxCompanySitemapPages(),
    companyUrlsPerPage: getMaxCompanyUrlsPerPage(),
    remoteUrls: getMaxRemoteSitemapUrls(),
  }
}

export function buildSitemapMetaComment(routeName: string): string {
  const meta = readMeta()
  return `<!-- seo_sitemap_meta route=${routeName} generated_at=${meta.generatedAtIso} phase=${meta.phase} jobs_shards=${meta.jobsShards} jobs_urls_per_shard=${meta.jobsUrlsPerShard} company_pages=${meta.companyPages} company_urls_per_page=${meta.companyUrlsPerPage} remote_urls=${meta.remoteUrls} -->`
}

export function buildSitemapMetaHeaders(routeName: string): Record<string, string> {
  const meta = readMeta()
  return {
    // Sitemaps are rendered per request (never at build time, when the database is unreachable). Cache them at the
    // edge/browser briefly instead; stale-while-revalidate lets a cached copy be served while a fresh one is built.
    'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
    'X-SEO-Sitemap-Route': routeName,
    'X-SEO-Sitemap-Generated-At': meta.generatedAtIso,
    'X-SEO-Phase': String(meta.phase),
    'X-SEO-Jobs-Shards': String(meta.jobsShards),
    'X-SEO-Jobs-Urls-Per-Shard': String(meta.jobsUrlsPerShard),
    'X-SEO-Company-Pages': String(meta.companyPages),
    'X-SEO-Company-Urls-Per-Page': String(meta.companyUrlsPerPage),
    'X-SEO-Remote-Urls': String(meta.remoteUrls),
  }
}

