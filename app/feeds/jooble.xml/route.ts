// app/feeds/jooble.xml/route.ts
// Jooble-format XML job feed (see lib/feeds/joobleFeed.ts). Lists the same jobs the job sitemap advertises (same
// quality gate and de-duplication), at most 5,000, each linking to its page on this site. Built per request, cached
// in-process for 30 minutes and at the CDN for an hour; Jooble's crawler reads a feed about once a day.
// Sent with X-Robots-Tag: noindex so the feed itself never competes with the pages it describes.

import { prisma } from '../../../lib/prisma'
import { getSiteUrl } from '../../../lib/seo/site'
import { buildGlobalExclusionsWhere, buildHighSalaryEligibilityWhere } from '../../../lib/jobs/queryJobs'
import { buildIndexableJobStructureWhere, dedupeIndexableJobs, evaluateJobIndexability } from '../../../lib/jobs/qualityGate'
import { buildFreshJobWhere, MAX_INDEXABLE_JOB_AGE_DAYS } from '../../../lib/jobs/freshness'
import { hasCanonicalJobShortId } from '../../../lib/jobs/jobSlug'
import { memoAsync } from '../../../lib/cache/memo'
import { buildJoobleFeedXml } from '../../../lib/feeds/joobleFeed'

export const dynamic = 'force-dynamic'

const MAX_JOBS = 5000

async function loadFeed(): Promise<{ xml: string; count: number }> {
  const rows = await prisma.job.findMany({
    where: {
      isExpired: false,
      shortId: { not: null },
      AND: [
        buildGlobalExclusionsWhere(),
        buildHighSalaryEligibilityWhere(),
        buildFreshJobWhere(MAX_INDEXABLE_JOB_AGE_DAYS - 2),
        buildIndexableJobStructureWhere(),
      ],
    },
    select: {
      id: true, shortId: true, externalId: true, title: true, roleSlug: true, company: true, companyId: true,
      locationRaw: true, citySlug: true, countryCode: true, remote: true, remoteMode: true, descriptionHtml: true,
      aiSnippet: true, aiOneLiner: true, salaryValidated: true, salaryConfidence: true, salaryCurrency: true,
      salaryPeriod: true, salaryMin: true, salaryMax: true, minAnnual: true, maxAnnual: true, currency: true,
      employmentType: true, isExpired: true, lastSeenAt: true, postedAt: true, createdAt: true, updatedAt: true,
      validThrough: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: MAX_JOBS * 2,
  })
  const jobs = dedupeIndexableJobs(rows.filter((j) => hasCanonicalJobShortId(j) && evaluateJobIndexability(j).indexable)).slice(0, MAX_JOBS)
  return buildJoobleFeedXml(jobs as never, getSiteUrl())
}

export async function GET() {
  try {
    const { xml, count } = await memoAsync('feed:jooble', 30 * 60 * 1000, loadFeed)
    return new Response(xml, {
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300, s-maxage=3600, stale-while-revalidate=86400',
        'X-Robots-Tag': 'noindex',
        'X-Feed-Job-Count': String(count),
      },
    })
  } catch {
    return new Response('Feed temporarily unavailable', { status: 503, headers: { 'Retry-After': '300' } })
  }
}
