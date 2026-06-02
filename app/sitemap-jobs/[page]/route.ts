// app/sitemap-jobs/[page]/route.ts

import { prisma } from '../../../lib/prisma'
import { buildJobSlug, hasCanonicalJobShortId } from '../../../lib/jobs/jobSlug'
import { getSiteUrl } from '../../../lib/seo/site'
import {
  buildGlobalExclusionsWhere,
  buildHighSalaryEligibilityWhere,
} from '../../../lib/jobs/queryJobs'
import {
  buildIndexableJobStructureWhere,
  dedupeIndexableJobs,
  evaluateJobIndexability,
} from '../../../lib/jobs/qualityGate'
import { buildFreshJobWhere, MAX_INDEXABLE_JOB_AGE_DAYS } from '../../../lib/jobs/freshness'
import { getMaxJobUrlsPerShard } from '../../../lib/seo/sitemapPolicy'
import { buildSitemapMetaComment, buildSitemapMetaHeaders } from '../../../lib/seo/sitemapResponseMeta'

const SITE_URL = getSiteUrl()
const PAGE_SIZE = 20000

export const dynamic = 'force-dynamic'
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
  return {
    isExpired: false,
    shortId: { not: null },
    AND: [
      buildGlobalExclusionsWhere(),
      buildHighSalaryEligibilityWhere(),
      buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS - 2),
      buildIndexableJobStructureWhere(),
    ],
  }
}

type Cursor = { updatedAt: Date; id: string }

function decodeCursor(token: string): Cursor | null {
  try {
    const b64 = token.replace(/-/g, '+').replace(/_/g, '/')
    const pad = b64.length % 4 ? '='.repeat(4 - (b64.length % 4)) : ''
    const raw = Buffer.from(b64 + pad, 'base64').toString('utf8')
    const parsed = JSON.parse(raw) as { u?: string; id?: string }

    const updatedAt = parsed.u ? new Date(parsed.u) : null
    const id = typeof parsed.id === 'string' ? parsed.id : null

    if (!updatedAt || Number.isNaN(updatedAt.getTime())) return null
    if (!id) return null

    return { updatedAt, id }
  } catch {
    return null
  }
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ page: string }> },
) {
  const params = await ctx.params
  const page = params.page || '1'
  const pageNum = Number(page)

  // Backwards-compat: old numeric pages > 1 no longer exist (cursor-based).
  if (Number.isFinite(pageNum) && pageNum > 1) {
    return Response.redirect(`${SITE_URL}/sitemap-jobs.xml`, 301)
  }

  const cursor =
    page === '1' || page === 'start'
      ? null
      : decodeCursor(page)

  if (cursor === null && page !== '1' && page !== 'start') {
    return new Response('Not found', { status: 404 })
  }

  const baseWhere = buildHundredKWhereBase()
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

  const jobs = await prisma.job.findMany({
    where,
    select: {
      id: true,
      shortId: true,
      externalId: true,
      title: true,
      roleSlug: true,
      company: true,
      companyId: true,
      locationRaw: true,
      citySlug: true,
      countryCode: true,
      remote: true,
      remoteMode: true,
      descriptionHtml: true,
      aiSnippet: true,
      aiOneLiner: true,
      salaryValidated: true,
      salaryConfidence: true,
      salaryCurrency: true,
      salaryPeriod: true,
      minAnnual: true,
      maxAnnual: true,
      currency: true,
      isExpired: true,
      lastSeenAt: true,
      postedAt: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: PAGE_SIZE,
  })

  const indexableJobs = dedupeIndexableJobs(
    jobs.filter(
      (job) => hasCanonicalJobShortId(job) && evaluateJobIndexability(job).indexable,
    ),
  ).slice(0, getMaxJobUrlsPerShard())

  const urlXml = indexableJobs
    .map((job) => {
      // ✅ Always generate canonical v2.8 URL (no legacy/roleSlug risk)
      const slug = buildJobSlug({ id: job.id, title: job.title })
      const loc = escapeXml(`${SITE_URL}/job/${slug}`)
      const lastmod = (job.updatedAt ?? new Date()).toISOString()

      return `  <url>
    <loc>${loc}</loc>
    <lastmod>${lastmod}</lastmod>
  </url>`
    })
    .join('\n')

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlXml}
  ${buildSitemapMetaComment('sitemap-jobs-page')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      ...buildSitemapMetaHeaders('sitemap-jobs-page'),
    },
  })
}
