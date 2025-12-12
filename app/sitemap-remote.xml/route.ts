// app/sitemap-remote.xml/route.ts
// Sitemap for:
// - /remote/[role]
// - /remote/[role]/[country]
// - /remote/[role]/[city]
// Only includes live, remote, $100k+ oriented jobs.

import { prisma } from '../../lib/prisma'
import { countryCodeToSlug } from '../../lib/seo/countrySlug'

const SITE_URL = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : 'https://www.6figjobs.com'

export const dynamic = "force-static"

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
          { isHundredKLocal: true }, // legacy safety flag
        ],
      },
      {
        OR: [{ remote: true }, { remoteMode: 'remote' }],
      },
      extra,
    ],
  }
}

export async function GET() {
  // Fetch distinct role-based slices from live (non-expired), remote, high-salary jobs
  const [roles, roleCountries, roleCities] = await Promise.all([
    prisma.job.findMany({
      where: buildRemoteHundredKWhere({
        roleSlug: { not: null },
      }),
      select: { roleSlug: true, updatedAt: true },
      distinct: ['roleSlug'],
    }),

    prisma.job.findMany({
      where: buildRemoteHundredKWhere({
        roleSlug: { not: null },
        countryCode: { not: null },
      }),
      select: { roleSlug: true, countryCode: true, updatedAt: true },
      distinct: ['roleSlug', 'countryCode'],
    }),

    prisma.job.findMany({
      where: buildRemoteHundredKWhere({
        roleSlug: { not: null },
        citySlug: { not: null },
      }),
      select: { roleSlug: true, citySlug: true, updatedAt: true },
      distinct: ['roleSlug', 'citySlug'],
    }),
  ])

  const urlSet = new Set<string>()

  /* ----------------------------- /remote/[role] ----------------------------- */
  for (const row of roles) {
    if (!row.roleSlug) continue
    const loc = `${SITE_URL}/remote/${row.roleSlug}`
    const lastmod = (row.updatedAt ?? new Date()).toISOString()
    urlSet.add(`<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`)
  }

  /* ------------------------ /remote/[role]/[country] ------------------------ */
  for (const row of roleCountries) {
    if (!row.roleSlug || !row.countryCode) continue
    const loc = `${SITE_URL}/remote/${row.roleSlug}/${countryCodeToSlug(row.countryCode)}`
    const lastmod = (row.updatedAt ?? new Date()).toISOString()
    urlSet.add(`<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`)
  }

  /* -------------------------- /remote/[role]/[city] ------------------------- */
  for (const row of roleCities) {
    if (!row.roleSlug || !row.citySlug) continue
    const loc = `${SITE_URL}/remote/${row.roleSlug}/${row.citySlug}`
    const lastmod = (row.updatedAt ?? new Date()).toISOString()
    urlSet.add(`<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod></url>`)
  }

  const xmlUrls = Array.from(urlSet).join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${xmlUrls}
</urlset>`

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  })
}
