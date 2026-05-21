import { createHash } from 'node:crypto'

import { prisma } from '../prisma'
import { ingestJob } from '../ingest'
import { OTHER_SOURCES } from '../ingest/sourcePriority'
import {
  classifyGenericCareerSource,
  extractCareerPageSignals,
  extractGenericJobDetail,
  fetchHtmlPage,
  hasStrongHighSalarySignal,
  type StructuredJobSnapshot,
} from './utils/companyCareersDiscovery'

const SOURCE = OTHER_SOURCES.COMPANY_CAREERS
const DETAIL_FETCH_LIMIT = 50
const DETAIL_CONCURRENCY = 6

type GenericScrapeStats = {
  created: number
  updated: number
  skipped: number
  errors: number
}

type GenericSourceRow = {
  id: string
  url: string
  company: {
    name: string
    website: string | null
  }
}

function buildExternalId(jobUrl: string): string {
  return createHash('sha1').update(jobUrl).digest('hex').slice(0, 32)
}

function buildResultStats(stats: GenericScrapeStats) {
  return {
    created: stats.created,
    updated: stats.updated,
    skipped: stats.skipped + stats.errors,
  }
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const output: R[] = new Array(items.length)
  let index = 0

  const workers = Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, async () => {
    while (index < items.length) {
      const currentIndex = index++
      output[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  })

  await Promise.all(workers)
  return output
}

function mergeListingSnapshot(
  detail: StructuredJobSnapshot | null,
  listing: StructuredJobSnapshot | undefined,
  fallbackUrl: string,
): StructuredJobSnapshot | null {
  const base = detail || listing || null
  if (!base?.title) return null

  return {
    title: base.title,
    url: detail?.url || listing?.url || fallbackUrl,
    applyUrl: detail?.applyUrl || listing?.applyUrl || fallbackUrl,
    descriptionHtml: detail?.descriptionHtml || listing?.descriptionHtml || null,
    descriptionText: detail?.descriptionText || listing?.descriptionText || null,
    locationText: detail?.locationText || listing?.locationText || null,
    remote: detail?.remote ?? listing?.remote ?? null,
    salaryRaw: detail?.salaryRaw || listing?.salaryRaw || null,
    salaryMin: detail?.salaryMin ?? listing?.salaryMin ?? null,
    salaryMax: detail?.salaryMax ?? listing?.salaryMax ?? null,
    salaryCurrency: detail?.salaryCurrency ?? listing?.salaryCurrency ?? null,
    salaryInterval: detail?.salaryInterval ?? listing?.salaryInterval ?? null,
    employmentType: detail?.employmentType || listing?.employmentType || null,
    postedAt: detail?.postedAt || listing?.postedAt || null,
    updatedAt: detail?.updatedAt || listing?.updatedAt || null,
    validThrough: detail?.validThrough || listing?.validThrough || null,
    raw: detail?.raw || listing?.raw || null,
  }
}

async function scrapeSourcePage(source: GenericSourceRow): Promise<StructuredJobSnapshot[]> {
  const page = await fetchHtmlPage(source.url)
  if (!page?.html) {
    throw new Error(`Failed to fetch ${source.url}`)
  }

  const signals = extractCareerPageSignals(page.html, page.url)
  if (!signals.jobLinks.length && !signals.structuredJobs.length) {
    return []
  }

  const listingByUrl = new Map(
    signals.structuredJobs
      .filter((job) => job.url)
      .map((job) => [job.url as string, job]),
  )

  const detailUrls = signals.jobLinks.slice(0, DETAIL_FETCH_LIMIT)
  const detailJobs = await mapLimit(detailUrls, DETAIL_CONCURRENCY, async (jobUrl) => {
    const detailPage = await fetchHtmlPage(jobUrl)
    if (!detailPage?.html) return null
    return mergeListingSnapshot(
      extractGenericJobDetail(detailPage.html, detailPage.url),
      listingByUrl.get(detailPage.url),
      detailPage.url,
    )
  })

  const merged = detailJobs.filter((job): job is StructuredJobSnapshot => Boolean(job))
  if (merged.length) return merged

  return signals.structuredJobs.filter((job) => Boolean(job.url))
}

async function loadGenericSources(): Promise<GenericSourceRow[]> {
  const sources = await prisma.companySource.findMany({
    where: {
      sourceType: 'generic_careers_page',
      isActive: true,
    },
    include: {
      company: {
        select: {
          name: true,
          website: true,
        },
      },
    },
    orderBy: [{ priority: 'asc' }, { updatedAt: 'desc' }],
    take: 600,
  })

  return sources
    .filter((source) => classifyGenericCareerSource(source.url, source.company.website).valid)
    .slice(0, 300)
}

async function updateSourceSuccess(sourceId: string, lastJobCount: number) {
  await prisma.companySource.update({
    where: { id: sourceId },
    data: {
      lastScrapedAt: new Date(),
      lastJobCount,
      scrapeStatus: 'success',
      scrapeError: null,
    },
  })
}

async function updateSourceFailure(sourceId: string, error: unknown) {
  await prisma.companySource.update({
    where: { id: sourceId },
    data: {
      scrapeStatus: 'error',
      scrapeError: String(error instanceof Error ? error.message : error).slice(0, 180),
    },
  })
}

export default async function scrapeGenericSources() {
  const stats: GenericScrapeStats = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: 0,
  }

  const sources = await loadGenericSources()
  if (!sources.length) {
    return buildResultStats(stats)
  }

  for (const source of sources) {
    try {
      const jobs = await scrapeSourcePage(source)
      let processed = 0

      for (const job of jobs) {
        if (!job.url || !job.title) {
          stats.skipped++
          continue
        }

        if (!hasStrongHighSalarySignal(job)) {
          stats.skipped++
          continue
        }

        const result = await ingestJob({
          externalId: buildExternalId(job.url),
          title: job.title,
          rawCompanyName: source.company.name,
          companyWebsiteUrl: source.company.website,
          url: job.url,
          applyUrl: job.applyUrl || job.url,
          source: SOURCE,
          descriptionHtml: job.descriptionHtml,
          descriptionText: job.descriptionText,
          employmentType: job.employmentType,
          locationText: job.locationText,
          isRemote: job.remote,
          salaryRaw: job.salaryRaw,
          salaryMin: job.salaryMin,
          salaryMax: job.salaryMax,
          salaryCurrency: job.salaryCurrency,
          salaryInterval: job.salaryInterval,
          postedAt: job.postedAt,
          updatedAt: job.updatedAt,
          raw: typeof job.raw === 'object' && job.raw ? (job.raw as Record<string, unknown>) : null,
        })

        processed++
        if (result.status === 'created') stats.created++
        else if (result.status === 'updated' || result.status === 'upgraded') stats.updated++
        else stats.skipped++
      }

      await updateSourceSuccess(source.id, processed)
    } catch (error) {
      stats.errors++
      await updateSourceFailure(source.id, error)
    }
  }

  return buildResultStats(stats)
}
