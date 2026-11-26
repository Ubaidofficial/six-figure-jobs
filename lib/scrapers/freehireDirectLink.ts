// lib/scrapers/freehireDirectLink.ts
//
// The employer's own apply link for a freehire job whose link goes to a job board (owner's decision, 2026-11-26: "where
// a board's job has a direct link to the employer's site or applicant tracking system, fetch it and use it; keep the
// board link where there is none"). Measured first on 12 listed jobs per board (scripts/probeDirectLinks.ts, run
// 45819590561): a direct link was found for about 5 in 12 eFinancialCareers and 4 in 12 Jobgether jobs, 2-3 in 12 on
// startup.jobs, Adzuna, karriere.at and PowerToFly, none on XING, LinkedIn, Cadremploi, WhatJobs, rocket-match or jobup.
//
// Two places are asked, in order:
//   1. freehire itself: the job's own `source_url`, then the same posting's copies from other sources
//      (GET /jobs/{slug}/copies, each read with GET /data/jobs/{slug}). Any link that is not a job board, an
//      aggregator or freehire counts: it is where another source sends applicants.
//   2. The board's page, only for the boards in PAGE_BOARDS (their robots.txt allows these pages, read 2026-11-26): where
//      its redirect ends, or the first link on it to an applicant tracking system. Only ATS links count here: on the
//      probe, other links on these pages were company homepages, news and accessibility pages, not the job.
// LinkedIn and XING pages are never fetched: their terms forbid automated access.
import { isAggregatorApplyUrl, isJobBoardApplyUrl, applySiteOf } from '../jobs/applyUrl'
import { detectAtsFromUrl } from '../normalizers/ats'

/** Boards whose job pages may be read for the employer link (robots.txt allows them; read 2026-11-26). */
export const PAGE_BOARDS = ['jobgether.com', 'karriere.at', 'powertofly.com']
/** Most of a posting's copies asked about. */
const MAX_COPIES = 5

export type DirectLinkDeps = {
  /** GET /data/jobs/{slug}: the job's `url` and `source_url`, or null. */
  dataJob: (slug: string) => Promise<{ url?: string | null; source_url?: string | null } | null>
  /** GET /jobs/{slug}/copies: the same posting from other sources. */
  copies: (slug: string) => Promise<Array<{ public_slug?: string | null }>>
  /** A board page: where its redirects ended and its HTML, or null. */
  page: (url: string) => Promise<{ finalUrl: string; html: string } | null>
}

/** A link applicants can use that is not a job board, an aggregator or freehire. */
export function isEmployerLink(url: string | null | undefined): url is string {
  if (!url || !/^https?:\/\//i.test(url)) return false
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return false
  }
  if (/(^|\.)freehire\.me$/i.test(host)) return false
  return !isJobBoardApplyUrl(url) && !isAggregatorApplyUrl(url)
}

/** A link as it appears in a page's HTML or JSON, made usable: entities decoded, cut at the first quote or tag. */
export function cleanPageLink(raw: string): string | null {
  const decoded = raw
    .replace(/&#38;|&amp;/g, '&')
    .replace(/&#34;|&quot;/g, '"')
    .replace(/\\\//g, '/')
  const cut = decoded.split(/["'<>\s\\]/)[0].replace(/[),.;]+$/, '')
  try {
    const url = new URL(cut)
    for (const key of [...url.searchParams.keys()]) if (/^utm_/i.test(key)) url.searchParams.delete(key)
    return url.toString()
  } catch {
    return null
  }
}

/** The first link in a page to an applicant tracking system (detectAtsFromUrl), or null. */
export function atsLinkInPage(html: string): string | null {
  for (const m of html.matchAll(/https?:(?:\/|\\\/){2}[^\s"'<>]+/g)) {
    const link = cleanPageLink(m[0])
    if (link && isEmployerLink(link) && detectAtsFromUrl(link)) return link
  }
  return null
}

/** The employer's link for the freehire job `slug` whose link `boardUrl` goes to a job board, or null. */
export async function findDirectLink(
  slug: string,
  boardUrl: string,
  sourceUrl: string | null | undefined,
  deps: DirectLinkDeps,
): Promise<{ url: string; via: 'source_url' | 'copy' | 'page' } | null> {
  if (isEmployerLink(sourceUrl)) return { url: sourceUrl, via: 'source_url' }
  for (const copy of (await deps.copies(slug)).slice(0, MAX_COPIES + 1)) {
    if (!copy?.public_slug || copy.public_slug === slug) continue
    const data = await deps.dataJob(copy.public_slug)
    for (const link of [data?.url, data?.source_url]) if (isEmployerLink(link)) return { url: link, via: 'copy' }
  }
  const site = applySiteOf(boardUrl)
  // Jobgether's robots.txt disallows its pages with a query string.
  if (site && PAGE_BOARDS.includes(site) && !new URL(boardUrl).search) {
    const page = await deps.page(boardUrl)
    if (page) {
      if (isEmployerLink(page.finalUrl) && detectAtsFromUrl(page.finalUrl)) return { url: page.finalUrl, via: 'page' }
      const link = atsLinkInPage(page.html)
      if (link) return { url: link, via: 'page' }
    }
  }
  return null
}
