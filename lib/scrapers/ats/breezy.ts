import type { ATSResult, AtsJob } from './types'
import {
  extractCareerPageSignals,
  extractGenericJobDetail,
  fetchHtmlPage,
} from '../utils/companyCareersDiscovery'

const DETAIL_CONCURRENCY = 4

function normalizeBreezyUrl(atsUrl: string): string | null {
  try {
    const url = new URL(atsUrl)
    return url.origin.replace(/\/+$/, '')
  } catch {
    return null
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

export async function scrapeBreezy(atsUrl: string): Promise<AtsJob[]> {
  const boardUrl = normalizeBreezyUrl(atsUrl)
  if (!boardUrl) {
    throw new Error(`[Breezy] Could not normalize atsUrl=${atsUrl}`)
  }

  const listingPage = await fetchHtmlPage(boardUrl)
  if (!listingPage?.html) {
    throw new Error(`[Breezy] Failed to fetch board page ${boardUrl}`)
  }

  const signals = extractCareerPageSignals(listingPage.html, listingPage.url)
  const jobLinks = signals.jobLinks.filter((url) => /\/p\//i.test(url))
  if (!jobLinks.length) {
    return []
  }

  const detailed = await mapLimit<string, AtsJob | null>(
    jobLinks.slice(0, 100),
    DETAIL_CONCURRENCY,
    async (jobUrl) => {
      const detailPage = await fetchHtmlPage(jobUrl)
      if (!detailPage?.html) return null

      const detail = extractGenericJobDetail(detailPage.html, detailPage.url)
      if (!detail?.title) return null

      return {
        externalId:
          detailPage.url.match(/\/p\/([^/?#]+)/i)?.[1] ||
          Buffer.from(detailPage.url).toString('base64').slice(0, 32),
        title: detail.title,
        url: detailPage.url,
        locationText: detail.locationText,
        remote: detail.remote,
        salaryMin: detail.salaryMin,
        salaryMax: detail.salaryMax,
        salaryCurrency: detail.salaryCurrency,
        salaryInterval: detail.salaryInterval,
        employmentType: detail.employmentType,
        descriptionHtml: detail.descriptionHtml,
        roleSlug: null,
        baseRoleSlug: null,
        seniority: null,
        discipline: null,
        isManager: /\bmanager|director|head\b/i.test(detail.title),
        postedAt: detail.postedAt,
        updatedAt: detail.updatedAt,
        raw: detail.raw,
      }
    },
  )

  return detailed.filter((job): job is NonNullable<typeof job> => Boolean(job))
}

export async function scrapeBreezyResult(atsUrl: string): Promise<ATSResult> {
  try {
    const jobs = await scrapeBreezy(atsUrl)
    return {
      success: true,
      source: 'breezy',
      atsUrl,
      jobs,
    }
  } catch (error: any) {
    return {
      success: false,
      source: 'breezy',
      atsUrl,
      error: error?.message || String(error),
    }
  }
}
