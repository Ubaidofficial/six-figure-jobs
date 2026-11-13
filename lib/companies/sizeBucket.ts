// lib/companies/sizeBucket.ts
//
// Company size as the site filters on it. The listing's size filter matches `Company.sizeBucket` EXACTLY against
// COMPANY_SIZE_BUCKETS ('1-10', '11-50', '51-200', '201-1000', '1000+'), but the sources write other ranges: freehire gives
// '201-500', '501-1000' and '1000+', and the AI enricher (lib/ai/companyEnricher.ts) writes '1001-5000' and '5000+'. Stored
// as they are, a large company would never match the '1000+' filter. This maps any of them to the site's bucket.
import { COMPANY_SIZE_BUCKETS } from '../jobs/levelSizeFacets'

export type SiteSizeBucket = (typeof COMPANY_SIZE_BUCKETS)[number]

/**
 * "501-1000", "1,001-5,000", "5000+", "200 employees" to the site's bucket, by the top of the range (for "N+", just above
 * N, so "1000+" is the top bucket and "200+" is 201-1000). Null for anything that is not a number or a range.
 */
export function toSiteSizeBucket(raw: unknown): SiteSizeBucket | null {
  if (typeof raw !== 'string') return null
  const s = raw
    .toLowerCase()
    .replace(/[,\s]/g, '')
    .replace(/[–—]/g, '-')
    .replace(/employees?$/, '')
  const m = /^(\d+)(?:-(\d+)|(\+))?$/.exec(s)
  if (!m) return null
  const lo = Number(m[1])
  const hi = m[2] !== undefined ? Number(m[2]) : m[3] ? lo + 1 : lo
  if (!(lo > 0) || hi < lo) return null
  if (hi <= 10) return '1-10'
  if (hi <= 50) return '11-50'
  if (hi <= 200) return '51-200'
  if (hi <= 1000) return '201-1000'
  return '1000+'
}
