// app/sitemap-jobs.xml/route.ts
// Sitemap index for job shards (100k+ focus)

import { prisma } from '../../lib/prisma'
import { getSiteUrl } from '../../lib/seo/site'
import {
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
} from '../../lib/jobs/queryJobs'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 20000

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

function buildHundredKWhereBase() {
  return {
    isExpired: false,
    AND: [buildGlobalExclusionsWhere(), buildHighSalaryEligibilityWhere()],
  }
}

type Cursor = { updatedAt: Date; id: string }

function encodeCursor(cursor: Cursor): string {
  const raw = JSON.stringify({ u: cursor.updatedAt.toISOString(), id: cursor.id })
  const b64 = Buffer.from(raw, 'utf8').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function GET() {
  const BUILD_LASTMOD = new Date().toISOString()
  const baseWhere = buildHundredKWhereBase()

  const sitemapEntries: string[] = []
  let cursor: Cursor | null = null

  // Build cursor-based shards (stable ordering; no deep OFFSET/skip).
  // `cursor` represents the last item of the previous page ("after" cursor).
  for (let page = 1; page <= 5000; page++) {
    const where: any = cursor
      ? ({
          ...baseWhere,
          AND: [
            ...(baseWhere.AND ?? []),
            {
              OR: [
                { updatedAt: { lt: cursor.updatedAt } },
                { AND: [{ updatedAt: cursor.updatedAt }, { id: { lt: cursor.id } }] },
              ],
            },
          ],
        } as any)
      : baseWhere

    const rows = await prisma.job.findMany({
      where,
      select: { id: true, updatedAt: true },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: PAGE_SIZE + 1,
    })

    // Maintain previous behaviour: always emit at least 1 sitemap entry.
    if (rows.length === 0) {
      if (page === 1) {
        const loc = escapeXml(`${SITE_URL}/sitemap-jobs/1`)
        sitemapEntries.push(`  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${BUILD_LASTMOD}</lastmod>
  </sitemap>`)
      }
      break
    }

    const token = cursor ? encodeCursor(cursor) : '1'
    const loc = escapeXml(`${SITE_URL}/sitemap-jobs/${token}`)
    sitemapEntries.push(`  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${BUILD_LASTMOD}</lastmod>
  </sitemap>`)

    if (rows.length <= PAGE_SIZE) break
    const last = rows[PAGE_SIZE - 1]
    cursor = { updatedAt: last.updatedAt, id: last.id }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
</sitemapindex>`

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  })
}
