// app/sitemap-remote.xml/route.ts
import { prisma } from '../../lib/prisma'
import { isCanonicalSlug, isTier1Role } from '@/lib/roles/canonicalSlugs'

const SITE_URL = 'https://www.6figjobs.com'

export const dynamic = 'force-static'

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
  const roles = await prisma.job.findMany({
    where: buildRemoteHundredKWhere({ roleSlug: { not: null } }),
    select: { roleSlug: true, updatedAt: true },
    distinct: ['roleSlug'],
  })

  const urls: string[] = []

  for (const row of roles) {
    const role = row.roleSlug
    if (!role) continue
    if (!isCanonicalSlug(role)) continue
    if (!isTier1Role(role)) continue

    const loc = `${SITE_URL}/remote/${role}`
    const lastmod = (row.updatedAt ?? new Date()).toISOString()
    urls.push(`<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`)
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
