// app/sitemap.xml/route.ts

import { BLOG_POSTS } from '../../lib/blog/posts'
import { getSiteUrl } from '../../lib/seo/site'
import { hasCountrySitemapEntries } from '../../lib/seo/countrySitemap'
import { getLatestBlogUpdate, getLatestJobUpdate } from '../../lib/seo/evergreenSitemap'
import { shouldAdvertiseSitemapFamily } from '../../lib/seo/sitemapPolicy'
import { getReleasedBatchNumbers } from '../../lib/seo/pseoBatches'
import { isPseoUnlockEnabled } from '../../lib/seo/pseoUnlock'
import { GET as getJobsIndex } from '../sitemap-jobs.xml/route'
import { GET as getCompanyIndex } from '../sitemap-company.xml/route'
import { GET as getSlicesIndex } from '../sitemap-slices.xml/route'
import { GET as getHubsSitemap } from '../sitemap-hubs.xml/route'
import { GET as getSalarySitemap } from '../sitemap-salary.xml/route'
import { GET as getCountrySitemap } from '../sitemap-country.xml/route'
import { GET as getBatchSitemap } from '../sitemap-batch/[batch]/route'
import { newestLastmod, sitemapDate } from '../../lib/seo/lastmod'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()

// Request-time: `lastmod` is read from the database (newest job update), which a deploy-time build cannot reach.
export const dynamic = 'force-dynamic'

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type Entry = { path: string; lastmod: string | null }

// A sitemap index may not list another index (sitemaps.org / Google), so the jobs, company and slices indexes are
// expanded here into the urlset files they point to. An index with no children (e.g. no published companies yet)
// is dropped instead of being advertised as an empty file.
async function expandChildIndex(getIndex: () => Promise<Response>): Promise<Entry[]> {
  try {
    const res = await getIndex()
    if (res.status !== 200) return []
    const xml = await res.text()
    const out: Entry[] = []
    for (const m of xml.matchAll(/<sitemap>\s*<loc>([^<]+)<\/loc>(?:\s*<lastmod>([^<]+)<\/lastmod>)?/g)) {
      const loc = m[1].replace(/&amp;/g, '&')
      out.push({ path: loc.startsWith(SITE_URL) ? loc.slice(SITE_URL.length + 1) : loc, lastmod: m[2] ?? null })
    }
    return out
  } catch {
    return []
  }
}

function buildAdvertisedSitemaps(): string[] {
  return [
    'sitemap-hubs.xml',
    // Released pSEO batches only (each is its own file so Search Console reports coverage per batch).
    ...(isPseoUnlockEnabled() ? getReleasedBatchNumbers().map((n) => `sitemap-batch/${n}.xml`) : []),
    ...(shouldAdvertiseSitemapFamily('salary') ? ['sitemap-salary.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('city') ? ['sitemap-city.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('remote') ? ['sitemap-remote.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('country') ? ['sitemap-country.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('category') ? ['sitemap-category.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('level') ? ['sitemap-level.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('browse') ? ['sitemap-browse.xml'] : []),
    ...(BLOG_POSTS.length > 0 && shouldAdvertiseSitemapFamily('blog') ? ['sitemap-blog.xml'] : []),
    ...(shouldAdvertiseSitemapFamily('skills') ? ['sitemap-skills.xml'] : []),
  ]
}

/**
 * The day a child sitemap last changed: the newest date among its own entries, read from the file itself so the index can
 * never claim more than the file does (it used to give every child the site's newest job, so all of them carried one
 * stamp). Null when the file cannot be read, and the index then leaves the date out.
 */
async function ownLastmod(path: string): Promise<string | null> {
  try {
    let res: Response | null = null
    if (path === 'sitemap-hubs.xml') res = await getHubsSitemap()
    else if (path === 'sitemap-salary.xml') res = await getSalarySitemap()
    else if (path === 'sitemap-country.xml') res = await getCountrySitemap()
    else if (path.startsWith('sitemap-batch/')) {
      const batch = path.slice('sitemap-batch/'.length)
      res = await getBatchSitemap(new Request(`${SITE_URL}/${path}`), { params: Promise.resolve({ batch }) })
    }
    if (!res || res.status !== 200) return null
    return newestLastmod(await res.text())
  } catch {
    return null
  }
}

const OWN_DATE_PATHS = /^(sitemap-(hubs|salary|country)\.xml|sitemap-batch\/)/

export async function GET() {
  // `lastmod` must be the day the child's content last changed, not the time of this request: Google stops trusting
  // lastmod on sites where every entry always says "now". When the date is unknown it is omitted. The files this site
  // submits today (hubs, released batches, salary bands, countries) are dated by their own entries; the families that
  // are advertised only from phase 2 keep the newest job's day until they are.
  const latestJob = await getLatestJobUpdate()
  const latestBlog = getLatestBlogUpdate()
  const fallbackFor = (path: string): string | null => sitemapDate(path === 'sitemap-blog.xml' ? latestBlog : latestJob)
  // The country sitemap is advertised only when it has URLs (an empty or missing child is worse than none).
  const hasCountries = shouldAdvertiseSitemapFamily('country') ? await hasCountrySitemapEntries().catch(() => false) : false
  const directPaths = buildAdvertisedSitemaps().filter((path) => path !== 'sitemap-country.xml' || hasCountries)
  const direct: Entry[] = await Promise.all(
    directPaths.map(async (path) => ({ path, lastmod: OWN_DATE_PATHS.test(path) ? await ownLastmod(path) : fallbackFor(path) })),
  )
  const [jobs, company, slices] = await Promise.all([
    shouldAdvertiseSitemapFamily('jobs') ? expandChildIndex(getJobsIndex) : [],
    shouldAdvertiseSitemapFamily('company') ? expandChildIndex(getCompanyIndex) : [],
    shouldAdvertiseSitemapFamily('slices') ? expandChildIndex(getSlicesIndex) : [],
  ])
  const sitemaps: Entry[] = [...direct, ...jobs, ...company, ...slices]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps
  .map(({ path, lastmod }) => {
    const loc = escapeXml(`${SITE_URL}/${path}`)
    return `  <sitemap>
    <loc>${loc}</loc>${lastmod ? `\n    <lastmod>${lastmod}</lastmod>` : ''}
  </sitemap>`
  })
  .join('\n')}
  ${buildSitemapMetaComment('sitemap')}
</sitemapindex>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
      ...buildSitemapMetaHeaders('sitemap'),
    },
  })
}
