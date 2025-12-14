// app/sitemap-remote.xml/route.ts
import { prisma } from '../../lib/prisma'
import { getSiteUrl } from '../../lib/seo/site'
import { isCanonicalSlug, isTier1Role } from '@/lib/roles/canonicalSlugs'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-static'
export const revalidate = 60 * 60 * 24 // 24h

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function buildRemoteHundredKWhere(extra: any = {}) {
  const threshold = BigInt(100_000)

  return {
    isExpired: false,
    AND: [
      {
        OR: [
          { maxAnnual: { gte: threshold } },
          { minAnnual: { gte: threshold } },
          { isHighSalary: true },
          { isHundredKLocal: true },
        ],
      },
      { OR: [{ remote: true }, { remoteMode: 'remote' }] },
      extra,
    ],
  }
}

export async function GET() {
  // IMPORTANT:
  // Using distinct + updatedAt is not deterministic. Use groupBy to get max(updatedAt) per role.
  const rows = await prisma.job.groupBy({
    by: ['roleSlug'],
    where: buildRemoteHundredKWhere({ roleSlug: { not: null } }),
    _max: { updatedAt: true },
    orderBy: { _max: { updatedAt: 'desc' } },
  })

  const urls: string[] = []

  for (const row of rows) {
    const role = row.roleSlug
    if (!role) continue
    if (!isCanonicalSlug(role)) continue
    if (!isTier1Role(role)) continue

    const loc = escapeXml(`${SITE_URL}/remote/${role}`)
    const lastmod = (row._max.updatedAt ?? new Date()).toISOString()

    urls.push(
      `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`,
    )
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
