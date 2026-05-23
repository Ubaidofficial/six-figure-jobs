// app/sitemap-jobs.xml/route.ts
// Sitemap index for job shards (100k+ focus)

import { prisma } from '../../lib/prisma'
import { buildFallbackUrlsetResponse } from '../../lib/seo/fallbackSitemap'
import { getSiteUrl } from '../../lib/seo/site'
import {
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
} from '../../lib/jobs/queryJobs'
import { buildIndexableJobStructureWhere } from '../../lib/jobs/qualityGate'
import { buildFreshJobWhere, MAX_INDEXABLE_JOB_AGE_DAYS } from '../../lib/jobs/freshness'
import { getMaxJobSitemapShards } from '../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../lib/seo/sitemapResponseMeta'

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
    AND: [
      buildGlobalExclusionsWhere(),
      buildHighSalaryEligibilityWhere(),
      buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS),
      buildIndexableJobStructureWhere(),
    ],
  }
}

type Cursor = { updatedAt: Date; id: string }

function encodeCursor(cursor: Cursor): string {
  const raw = JSON.stringify({ u: cursor.updatedAt.toISOString(), id: cursor.id })
  const b64 = Buffer.from(raw, 'utf8').toString('base64')
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export async function GET() {
  try {
    const baseWhere = buildHundredKWhereBase()
    const maxShards = getMaxJobSitemapShards()

    const sitemapEntries: string[] = []
    let cursor: Cursor | null = null

    // Build cursor-based shards (stable ordering; no deep OFFSET/skip).
    // `cursor` represents the last item of the previous page ("after" cursor).
    for (let page = 1; page <= maxShards; page++) {
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

      if (rows.length === 0) {
        break
      }

      const token = cursor ? encodeCursor(cursor) : '1'
      const loc = escapeXml(`${SITE_URL}/sitemap-jobs/${token}`)
      const lastmod = rows[0]?.updatedAt?.toISOString() ?? new Date().toISOString()
      sitemapEntries.push(`  <sitemap>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </sitemap>`)

      if (rows.length <= PAGE_SIZE) break
      const last = rows[PAGE_SIZE - 1]
      cursor = { updatedAt: last.updatedAt, id: last.id }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries.join('\n')}
  ${buildSitemapMetaComment('sitemap-jobs')}
</sitemapindex>`

    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        ...buildSitemapMetaHeaders('sitemap-jobs'),
      },
    })
  } catch (error) {
    return buildFallbackUrlsetResponse('sitemap-jobs', [], error)
  }
}
