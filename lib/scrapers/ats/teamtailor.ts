import type { ATSResult, AtsJob } from './types'
import {
  extractCareerPageSignals,
  extractGenericJobDetail,
  fetchHtmlPage,
} from '../utils/companyCareersDiscovery'

const DETAIL_CONCURRENCY = 4

function normalizeTeamtailorUrl(atsUrl: string): string | null {
  try {
    const url = new URL(atsUrl)
    return `${url.origin}${url.pathname === '/' ? '' : url.pathname}`.replace(/\/+$/, '') || url.origin
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

export async function scrapeTeamtailor(atsUrl: string): Promise<AtsJob[]> {
  const boardUrl = normalizeTeamtailorUrl(atsUrl)
  if (!boardUrl) {
    throw new Error(`[Teamtailor] Could not normalize atsUrl=${atsUrl}`)
  }

  const listingPage = await fetchHtmlPage(boardUrl)
  if (!listingPage?.html) {
    throw new Error(`[Teamtailor] Failed to fetch board page ${boardUrl}`)
  }

  const signals = extractCareerPageSignals(listingPage.html, listingPage.url)
  const jobLinks = signals.jobLinks.filter((url) => /\/jobs\//i.test(url))
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
          detailPage.url.match(/\/jobs\/([^/?#]+)/i)?.[1] ||
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

export async function scrapeTeamtailorResult(atsUrl: string): Promise<ATSResult> {
  try {
    const jobs = await scrapeTeamtailor(atsUrl)
    return {
      success: true,
      source: 'teamtailor',
      atsUrl,
      jobs,
    }
  } catch (error: any) {
    return {
      success: false,
      source: 'teamtailor',
      atsUrl,
      error: error?.message || String(error),
    }
  }
}
