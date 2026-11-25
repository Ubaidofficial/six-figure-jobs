// lib/scrapers/ats/oraclecloud.ts
//
// Oracle Recruiting Cloud (Oracle Fusion HCM "Candidate Experience") job boards, read from their public REST API (owner's
// request, 2026-11-25: "do all three", item 3; remote100k listed 40 jobs at Argano, Akamai, Icertis and Fortinet on
// these boards). A board URL is the candidate site: https://<host>/hcmUI/CandidateExperience/<lang>/sites/<siteNumber>.
//   - list:   GET https://<host>/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true
//               &finder=findReqs;siteNumber=<site>,limit=<n>,offset=<n>,sortBy=POSTING_DATES_DESC
//   - detail: GET .../recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id="<id>",siteNumber=<site>
// These boards publish no pay field: pay is read from the posting's own sentences, only through lib/jobs/payEvidence.ts
// (CLAUDE.md), and the usual salary gate applies at ingest.
import { readPayFromDescription } from '../../jobs/payEvidence'
import type { ATSResult, AtsJob } from './types'

const PAGE = 25
const MAX_JOBS = 400
const DETAIL_CONCURRENCY = 3
const HEADERS = { Accept: 'application/json', 'User-Agent': 'SixFigureJobs/1.0 (+job-board-scraper)' }

export type OracleBoard = { host: string; site: string; lang: string }

/** Host, site number and language of an Oracle candidate-site URL (pure); null when it is not one. */
export function parseOracleBoard(url: string): OracleBoard | null {
  try {
    const u = new URL(url)
    if (!/\.oraclecloud\.com$/i.test(u.hostname)) return null
    const m = u.pathname.match(/\/CandidateExperience\/([a-z]{2}(?:-[A-Z]{2})?)\/sites\/([^/?#]+)/i)
    if (!m) return null
    return { host: u.hostname.toLowerCase(), lang: m[1], site: m[2] }
  } catch {
    return null
  }
}

type ListItem = { Id: string; Title?: string; PostedDate?: string; PrimaryLocation?: string; PrimaryLocationCountry?: string; WorkplaceTypeCode?: string }
type Detail = {
  Id: string
  Title?: string
  ExternalDescriptionStr?: string | null
  ExternalResponsibilitiesStr?: string | null
  ExternalQualificationsStr?: string | null
  PrimaryLocation?: string | null
  PrimaryLocationCountry?: string | null
  WorkplaceTypeCode?: string | null
  ExternalPostedStartDate?: string | null
  ExternalPostedEndDate?: string | null
  JobSchedule?: string | null
}

/** Oracle's workplace code as ours (pure). */
export function workplaceFromOracle(code: string | null | undefined): AtsJob['workplaceType'] {
  if (code === 'ORA_REMOTE') return 'remote'
  if (code === 'ORA_HYBRID') return 'hybrid'
  if (code === 'ORA_ON_SITE' || code === 'ORA_ONSITE') return 'onsite'
  return null
}

/** One job as the ATS ingest takes it (pure). */
export function mapOracleJob(board: OracleBoard, d: Detail): AtsJob {
  const descriptionHtml = [d.ExternalDescriptionStr, d.ExternalResponsibilitiesStr, d.ExternalQualificationsStr].filter(Boolean).join('\n') || null
  const country = d.PrimaryLocationCountry ? d.PrimaryLocationCountry.toLowerCase() : null
  const pay = readPayFromDescription(descriptionHtml, { countries: country ? [country] : null, location: d.PrimaryLocation ?? null })
  const workplaceType = workplaceFromOracle(d.WorkplaceTypeCode)
  return {
    externalId: String(d.Id),
    title: String(d.Title ?? '').trim(),
    url: `https://${board.host}/hcmUI/CandidateExperience/${board.lang}/sites/${board.site}/job/${d.Id}`,
    locationText: d.PrimaryLocation ?? null,
    countryCode: d.PrimaryLocationCountry ?? null,
    remote: workplaceType === 'remote',
    workplaceType,
    salaryMin: pay?.min ?? null,
    salaryMax: pay?.max ?? null,
    salaryCurrency: pay?.currency ?? null,
    salaryInterval: pay ? 'year' : null,
    salaryRaw: pay?.quote ?? null,
    employmentType: d.JobSchedule ?? null,
    descriptionHtml,
    postedAt: d.ExternalPostedStartDate ? new Date(d.ExternalPostedStartDate) : null,
    validThrough: d.ExternalPostedEndDate ? new Date(d.ExternalPostedEndDate) : null,
    raw: { countryCode: d.PrimaryLocationCountry ?? null },
  }
}

async function getJson<T>(url: string, fetchFn: typeof fetch): Promise<T> {
  const res = await fetchFn(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url.slice(0, 120)}`)
  return (await res.json()) as T
}

export async function scrapeOracleCloudResult(atsUrl: string, fetchFn: typeof fetch = fetch): Promise<ATSResult> {
  const board = parseOracleBoard(atsUrl)
  if (!board) return { success: false, source: 'oraclecloud', atsUrl, error: 'Not an Oracle candidate-site URL' }
  const base = `https://${board.host}/hcmRestApi/resources/latest`
  try {
    const ids: ListItem[] = []
    for (let offset = 0; offset < MAX_JOBS; offset += PAGE) {
      const finder = `findReqs;siteNumber=${board.site},limit=${PAGE},offset=${offset},sortBy=POSTING_DATES_DESC`
      const d = await getJson<{ items?: Array<{ requisitionList?: ListItem[]; TotalJobsCount?: number }> }>(
        `${base}/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList&finder=${encodeURIComponent(finder).replace(/%3B/g, ';').replace(/%3D/g, '=').replace(/%2C/g, ',')}`,
        fetchFn,
      )
      const page = d.items?.[0]?.requisitionList ?? []
      ids.push(...page)
      const total = d.items?.[0]?.TotalJobsCount ?? 0
      if (page.length < PAGE || ids.length >= total) break
    }

    const jobs: AtsJob[] = []
    let next = 0
    await Promise.all(
      Array.from({ length: DETAIL_CONCURRENCY }, async () => {
        while (next < ids.length) {
          const item = ids[next++]
          try {
            const finder = `ById;Id="${item.Id}",siteNumber=${board.site}`
            const d = await getJson<{ items?: Detail[] }>(`${base}/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=${encodeURIComponent(finder).replace(/%3B/g, ';').replace(/%3D/g, '=').replace(/%2C/g, ',')}`, fetchFn)
            const detail = d.items?.[0]
            if (detail?.Title) jobs.push(mapOracleJob(board, detail))
          } catch {
            // One job that does not answer is left out; the rest of the board is still read.
          }
        }
      }),
    )
    return { success: true, source: 'oraclecloud', atsUrl, jobs }
  } catch (error) {
    return { success: false, source: 'oraclecloud', atsUrl, error: error instanceof Error ? error.message : String(error) }
  }
}
