// lib/jobs/jobsListQuery.ts
//
// The /jobs listing's URL parameters turned into a queryJobs input, read the same way by the page and by /api/jobs
// (the "load more" request, which sends the page's own parameters). The API used to read its own subset: it ignored
// remoteRegion and compared minSalary in a different currency, so page 2 of /jobs?remoteRegion=europe came back with
// jobs from anywhere (2026-11-19 audit).

import { buildKeywordPlan } from '../search/keywordPlan'
import type { JobQueryInput } from './queryJobs'
import { normalizeRemoteRegionSlug } from './remoteRegions'
import { salaryFilterAmount, salaryFilterCurrency } from './salaryFilter'

export type ListingParams = { get(key: string): string | undefined; getAll(key: string): string[] }

export function parseJobsListing(params: ListingParams, page: number, pageSize: number) {
  const keyword = (params.get('q') || '').trim() || undefined
  const tech = (params.get('tech') || '').trim() || undefined
  const visa = params.get('visa') === '1'
  // exact=1: the visitor chose to search for the words as typed, without typo correction.
  const exact = params.get('exact') === '1'
  const rawCountry = (params.get('country') || '').trim().toUpperCase()
  const country = rawCountry.length === 2 ? rawCountry : undefined
  const rawRemoteMode = (params.get('remoteMode') || '').trim()
  const remoteMode =
    rawRemoteMode === 'remote' || rawRemoteMode === 'hybrid' || rawRemoteMode === 'onsite' ? rawRemoteMode : undefined
  // Remote jobs in a region (a set of countries), or "global" for jobs that can be done from anywhere.
  const remoteRegion = normalizeRemoteRegionSlug(params.get('remoteRegion')) ?? undefined
  const rawSort = (params.get('sort') || '').trim()
  // A keyword search is ranked by relevance unless the visitor picked another order.
  const sort: 'recent' | 'salary' | 'relevant' =
    rawSort === 'recent' || rawSort === 'salary' || rawSort === 'relevant' ? rawSort : keyword ? 'relevant' : 'recent'
  const roles = params.getAll('role')
  const seniority = params.getAll('seniority')
  const companySizes = params.getAll('companySize')
  const minSalaryRaw = Number(params.get('minSalary') || '') || null
  // The site's floor ($100k) is not a filter: only a higher step narrows the list.
  const minSalary =
    minSalaryRaw && Number.isFinite(minSalaryRaw) && minSalaryRaw > 100_000 ? Math.min(450_000, minSalaryRaw) : null
  const salaryCurrency = minSalary ? salaryFilterCurrency(country) : null

  const queryInput: JobQueryInput = {
    page,
    pageSize,
    sortBy: sort === 'recent' ? 'date' : sort === 'relevant' && keyword ? 'relevant' : 'salary',
    roleSlugs: roles.length ? roles : undefined,
    countryCode: country,
    remoteMode,
    remoteRegion,
    seniorityLevels: seniority.length ? seniority : undefined,
    companySizeBuckets: companySizes.length ? companySizes : undefined,
    tech,
    keyword,
    ...(visa ? { visaSponsorship: true } : {}),
    ...(keyword && exact ? { keywordPlan: buildKeywordPlan(keyword, null) } : {}),
    ...(minSalary && salaryCurrency ? { currency: salaryCurrency, minAnnual: salaryFilterAmount(minSalary, salaryCurrency) } : {}),
  }

  return { queryInput, keyword, tech, visa, exact, rawCountry, country, remoteMode, remoteRegion, sort, roles, seniority, companySizes, minSalary }
}
