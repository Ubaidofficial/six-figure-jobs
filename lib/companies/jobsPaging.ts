// Page arithmetic for the jobs list on /company/[slug]: ten jobs at a time, the first ten in the HTML, the rest
// through "Show more jobs" (a real link to /company/<slug>/page/N that the client component turns into a fetch).
// Pure on purpose: the page, the API route and the client component all use these, and nothing here touches the database.

export const COMPANY_JOBS_PAGE_SIZE = 10

/** Page numbers above this are rejected, not clamped (no company has 10,000 jobs; a bigger number is a junk URL). */
const MAX_PAGE = 1000

/** A page number from a URL segment or query value: digits only, 1 to 1000, else null. No rounding, no "2abc". */
export function parseCompanyJobsPage(raw: unknown): number | null {
  if (typeof raw !== 'string' || !/^[1-9]\d{0,3}$/.test(raw)) return null
  const page = Number(raw)
  return page <= MAX_PAGE ? page : null
}

export function companyJobsTotalPages(total: number): number {
  return Math.max(1, Math.ceil(Math.max(0, total) / COMPANY_JOBS_PAGE_SIZE))
}

/** Where page `page` sits in a list of `total` jobs. `start` is the 0-based offset, `end` is exclusive. */
export function companyJobsWindow(total: number, page: number) {
  const totalPages = companyJobsTotalPages(total)
  const safePage = Math.min(Math.max(1, Math.floor(page) || 1), totalPages)
  const start = (safePage - 1) * COMPANY_JOBS_PAGE_SIZE
  const end = Math.min(Math.max(0, total), start + COMPANY_JOBS_PAGE_SIZE)
  return { page: safePage, totalPages, start, end, hasMore: end < total }
}

/** Page 1 is the company page itself, so it has one address only. */
export function companyJobsPagePath(slug: string, page: number): string {
  return page <= 1 ? `/company/${slug}` : `/company/${slug}/page/${page}`
}

/** "Showing 10 of 37 jobs", or "Showing 11–20 of 37 jobs" when the list does not start at the first job. */
export function companyJobsShowingText(start: number, end: number, total: number): string {
  const range = start > 0 ? `${start + 1}–${end}` : `${end}`
  return `Showing ${range} of ${total.toLocaleString('en-US')} ${total === 1 ? 'job' : 'jobs'}`
}
