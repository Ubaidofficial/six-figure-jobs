// app/sitemap-jobs.xml/route.ts
// Sitemap index for job shards (100k+ focus)

import { prisma } from '../../lib/prisma'
import { getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 20000
const BUILD_LASTMOD = new Date().toISOString()

export const dynamic = 'force-static'
export const revalidate = 86400 // 24h

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildHundredKWhereBase() {
  const threshold = BigInt(100_000)
  return {
    isExpired: false,
    OR: [
      { maxAnnual: { gte: threshold } },
      { minAnnual: { gte: threshold } },
      { isHighSalary: true },
      { isHundredKLocal: true },
    ],
  }
}

export async function GET() {
  const total = await prisma.job.count({
    where: buildHundredKWhereBase(),
  })

  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const sitemapEntries = Array.from({ length: pages }).map((_, i) => {
    const page = i + 1
    const loc = escapeXml(`${SITE_URL}/sitemap-jobs/${page}`)
    return `  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${BUILD_LASTMOD}</lastmod>
  </sitemap>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</sitemapindex>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
