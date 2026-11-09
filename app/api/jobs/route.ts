import { NextResponse } from 'next/server'
import { queryJobs, type JobQueryInput } from '@/lib/jobs/queryJobs'
import { buildKeywordPlan } from '@/lib/search/keywordPlan'
import { readHubExtraFilters } from '@/lib/jobs/hubFilters'
const PAGE_SIZE = 24
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  // A whole page number from 1; "abc" made this NaN and the query threw (500, found 2026-11-08), "-5" read as page 1.
  const page = Math.max(1, Math.floor(Number(searchParams.get('page'))) || 1)
  const country = searchParams.get('country') || undefined
  const remoteMode = (searchParams.get('remoteMode') || undefined) as 'remote' | 'hybrid' | 'onsite' | undefined
  const keyword = (searchParams.get('q') || '').trim() || undefined
  const rawSort = searchParams.get('sort')
  // Mirrors the /jobs page: a keyword search is ranked by relevance unless another order was chosen.
  const sort = (rawSort === 'recent' || rawSort === 'salary' || rawSort === 'relevant' ? rawSort : keyword ? 'relevant' : 'recent') as
    | 'recent'
    | 'salary'
    | 'relevant'
  const tech = searchParams.get('tech') || undefined
  const visa = searchParams.get('visa') === '1'
  const exact = searchParams.get('exact') === '1'
  const roles = searchParams.getAll('role')
  const seniority = searchParams.getAll('seniority')
  const companySizes = searchParams.getAll('companySize')
  const minSalary = Number(searchParams.get('minSalary')) || null

  const queryInput: JobQueryInput = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort === 'recent' ? 'date' : sort === 'relevant' && keyword ? 'relevant' : 'salary',
    roleSlugs: roles.length ? roles : undefined,
    countryCode: country,
    remoteMode,
    seniorityLevels: seniority.length ? seniority : undefined,
    companySizeBuckets: companySizes.length ? companySizes : undefined,
    tech,
    keyword,
    // remoteRegion, city: the same filters the /jobs page applies (its "load more" calls this route).
    ...readHubExtraFilters((key) => searchParams.getAll(key)),
    ...(visa ? { visaSponsorship: true } : {}),
    ...(keyword && exact ? { keywordPlan: buildKeywordPlan(keyword, null) } : {}),
    ...(minSalary ? { minAnnual: minSalary } : {}),
  }

  const data = await queryJobs(queryInput)

  // Convert BigInt to string for JSON serialization
  const serializedData = JSON.parse(
    JSON.stringify(data, (key, value) =>
      typeof value === 'bigint' ? value.toString() : value
    )
  )

  return NextResponse.json(serializedData)
}
