import { prisma } from '../../../lib/prisma'
import JobsTable from './JobsTable'

type SearchParams = Record<string, string | undefined>

export type JobRow = {
  id: string
  title: string
  company: string
  source: string
  salaryMin: bigint | null
  salaryMax: bigint | null
  salaryCurrency: string | null
  isExpired: boolean
  remote: boolean | null
  postedAt: Date | null
  createdAt: Date
  applyUrl: string | null
  url: string | null
}

export default async function AdminJobsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = (await searchParams) || {}
  const page = Math.max(1, Number(sp.page || 1))
  const q = sp.q || ''
  const source = sp.source || ''
  const expired = sp.expired
  const pageSize = 50

  const where: Record<string, unknown> = {}
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { company: { contains: q, mode: 'insensitive' } }]
  if (source) where.source = source
  if (expired === '1') where.isExpired = true
  else if (expired === '0') where.isExpired = false

  const [jobs, total, sources] = await Promise.all([
    prisma.job.findMany({
      where,
      select: {
        id: true, title: true, company: true, source: true,
        salaryMin: true, salaryMax: true, salaryCurrency: true,
        isExpired: true, remote: true, postedAt: true, createdAt: true, applyUrl: true, url: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.job.count({ where }),
    prisma.job.groupBy({ by: ['source'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 20 }),
  ])

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Jobs</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>{total.toLocaleString()} jobs matching filters</p>

      <JobsTable
        jobs={jobs as unknown as JobRow[]}
        total={total}
        page={page}
        pageSize={pageSize}
        sources={sources.map((s) => ({ source: s.source, count: s._count.id }))}
        initialQ={q}
        initialSource={source}
        initialExpired={expired ?? ''}
      />
    </div>
  )
}
