import { NextResponse } from 'next/server'
import { queryJobs, type JobQueryInput } from '@/lib/jobs/queryJobs'
const PAGE_SIZE = 24
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const page = Number(searchParams.get('page') || '1')
  const country = searchParams.get('country') || undefined
  const remoteMode = (searchParams.get('remoteMode') || undefined) as 'remote' | 'hybrid' | 'onsite' | undefined
  const sort = (searchParams.get('sort') || 'recent') as 'recent' | 'salary'
  const tech = searchParams.get('tech') || undefined
  const roles = searchParams.getAll('role')
  const seniority = searchParams.getAll('seniority')
  const companySizes = searchParams.getAll('companySize')
  const minSalary = Number(searchParams.get('minSalary')) || null

  const queryInput: JobQueryInput = {
    page,
    pageSize: PAGE_SIZE,
    sortBy: sort === 'recent' ? 'date' : 'salary',
    roleSlugs: roles.length ? roles : undefined,
    countryCode: country,
    remoteMode,
    seniorityLevels: seniority.length ? seniority : undefined,
    companySizeBuckets: companySizes.length ? companySizes : undefined,
    tech,
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
