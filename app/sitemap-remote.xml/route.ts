// app/sitemap-remote.xml/route.ts
import { getTier1Slugs } from '@/lib/roles/canonicalSlugs'
import { buildWhere } from '../../lib/jobs/queryJobs'
import { prisma } from '../../lib/prisma'
import { isRemoteRolePageIndexable } from '../../lib/seo/indexabilityGates'
import { getSiteUrl } from '../../lib/seo/site'

const SITE_URL = getSiteUrl()

export const dynamic = 'force-dynamic'
export const revalidate = 43200 // 24h

function escapeXml(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

type RemoteRoleSitemapRow = {
  roleSlug: string
  total: number
  lastmod: string
}

async function collectRemoteRoleRows(): Promise<RemoteRoleSitemapRow[]> {
  const rows = await Promise.all(
    getTier1Slugs().map(async (roleSlug) => {
      // Keep sitemap inclusion aligned with /remote/[role] page query logic.
      const where = buildWhere({
        roleSlugs: [roleSlug],
        remoteOnly: true,
      })

      const agg = await prisma.job.aggregate({
        where,
        _count: { _all: true },
        _max: { updatedAt: true },
      })

      const total = Number(agg._count?._all ?? 0)
      if (!isRemoteRolePageIndexable(total)) return null

      return {
        roleSlug,
        total,
        lastmod: (agg._max.updatedAt ?? new Date()).toISOString(),
      }
    }),
  )

  return rows
    .filter((row): row is RemoteRoleSitemapRow => Boolean(row))
    .sort((a, b) => {
      if (b.total !== a.total) return b.total - a.total
      return b.lastmod.localeCompare(a.lastmod)
    })
}

export async function GET() {
  const rows = await collectRemoteRoleRows()

  const urls: string[] = []

  for (const row of rows) {
    const loc = escapeXml(`${SITE_URL}/remote/${row.roleSlug}`)
    const lastmod = row.lastmod

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
