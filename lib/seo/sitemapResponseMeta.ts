import {
  getMaxCompanySitemapPages,
  getMaxCompanyUrlsPerPage,
  getMaxJobSitemapShards,
  getMaxJobUrlsPerShard,
  getMaxRemoteSitemapUrls,
  isCoreOnlySitemapMode,
} from './sitemapPolicy'

type SitemapMeta = {
  generatedAtIso: string
  coreOnly: boolean
  jobsShards: number
  jobsUrlsPerShard: number
  companyPages: number
  companyUrlsPerPage: number
  remoteUrls: number
}

function readMeta(): SitemapMeta {
  return {
    generatedAtIso: new Date().toISOString(),
    coreOnly: isCoreOnlySitemapMode(),
    jobsShards: getMaxJobSitemapShards(),
    jobsUrlsPerShard: getMaxJobUrlsPerShard(),
    companyPages: getMaxCompanySitemapPages(),
    companyUrlsPerPage: getMaxCompanyUrlsPerPage(),
    remoteUrls: getMaxRemoteSitemapUrls(),
  }
}

export function buildSitemapMetaComment(routeName: string): string {
  const meta = readMeta()
  return `<!-- seo_sitemap_meta route=${routeName} generated_at=${meta.generatedAtIso} core_only=${meta.coreOnly ? '1' : '0'} jobs_shards=${meta.jobsShards} jobs_urls_per_shard=${meta.jobsUrlsPerShard} company_pages=${meta.companyPages} company_urls_per_page=${meta.companyUrlsPerPage} remote_urls=${meta.remoteUrls} -->`
}

export function buildSitemapMetaHeaders(routeName: string): Record<string, string> {
  const meta = readMeta()
  return {
    'X-SEO-Sitemap-Route': routeName,
    'X-SEO-Sitemap-Generated-At': meta.generatedAtIso,
    'X-SEO-Core-Only': meta.coreOnly ? '1' : '0',
    'X-SEO-Jobs-Shards': String(meta.jobsShards),
    'X-SEO-Jobs-Urls-Per-Shard': String(meta.jobsUrlsPerShard),
    'X-SEO-Company-Pages': String(meta.companyPages),
    'X-SEO-Company-Urls-Per-Page': String(meta.companyUrlsPerPage),
    'X-SEO-Remote-Urls': String(meta.remoteUrls),
  }
}

