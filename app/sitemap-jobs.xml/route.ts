// app/sitemap-jobs.xml/route.ts
// Sitemap index for job shards (100k+ focus)

import { prisma } from '../../lib/prisma'

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'
const PAGE_SIZE = 20000

export const dynamic = "force-static"

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
    return `  <sitemap>
    <loc>${SITE_URL}/sitemap-jobs/${page}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
  </sitemap>`
  })

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</sitemapindex>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml' },
  })
}
