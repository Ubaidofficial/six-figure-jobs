import { buildJobSlugHref } from '../../../../lib/jobs/jobSlug'
import { buildSalaryText } from '../../../../lib/jobs/salary'
import { prisma } from '../../../../lib/prisma'
import { PageHead, Pager, intParam, s } from '../ui'
import JobsTable from './JobsTable'
import { requireAdmin } from '../requireAdmin'

export const dynamic = 'force-dynamic'

/** A job as the list shows it: plain values only (no BigInt), the pay as the site shows it, and its public link. */
export type JobRow = {
  id: string
  title: string
  company: string | null
  source: string
  location: string | null
  remoteMode: string | null
  pay: string | null
  isExpired: boolean
  posted: string
  href: string
  applyUrl: string | null
}

const PAGE_SIZE = 50

export default async function AdminJobsPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = (await searchParams) || {}
  const page = intParam(sp.page, 1, 1, 10_000)
  const q = (sp.q ?? '').trim().slice(0, 100)
  const source = sp.source ?? ''
  const status = sp.status === 'live' || sp.status === 'expired' ? sp.status : ''

  const where: Record<string, unknown> = {}
  if (q) where.OR = [{ title: { contains: q, mode: 'insensitive' } }, { company: { contains: q, mode: 'insensitive' } }]
  if (source) where.source = source
  if (status) where.isExpired = status === 'expired'

  const [jobs, total, sources] = await Promise.all([
    prisma.job.findMany({
      where,
      select: {
        id: true, shortId: true, title: true, company: true, source: true, locationRaw: true, remoteMode: true,
        minAnnual: true, maxAnnual: true, currency: true, salaryMin: true, salaryMax: true, salaryCurrency: true,
        salaryPeriod: true, isExpired: true, postedAt: true, createdAt: true, applyUrl: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.job.count({ where }),
    prisma.job.groupBy({ by: ['source'], _count: { id: true }, orderBy: { _count: { id: 'desc' } }, take: 30 }),
  ])

  const rows: JobRow[] = jobs.map((j) => ({
    id: j.id,
    title: j.title,
    company: j.company,
    source: j.source.replace(/^board:/, ''),
    location: j.locationRaw,
    remoteMode: j.remoteMode,
    pay: buildSalaryText(j as Parameters<typeof buildSalaryText>[0]),
    isExpired: j.isExpired,
    posted: (j.postedAt ?? j.createdAt).toISOString().slice(0, 10),
    href: buildJobSlugHref(j),
    applyUrl: j.applyUrl,
  }))

  return (
    <>
      <PageHead title="Jobs" lede="Every job in the database, newest first. Pay is shown as the job page shows it." />
      <form className={s.toolbar} action="/ubaid93/jobs">
        <input className={s.input} name="q" defaultValue={q} placeholder="Title or company" aria-label="Title or company" />
        <select className={s.select} name="source" defaultValue={source} aria-label="Source">
          <option value="">All sources</option>
          {sources.map((x) => (
            <option key={x.source} value={x.source}>
              {x.source.replace(/^board:/, '')} ({x._count.id.toLocaleString()})
            </option>
          ))}
        </select>
        <select className={s.select} name="status" defaultValue={status} aria-label="Status">
          <option value="">Live and expired</option>
          <option value="live">Live</option>
          <option value="expired">Expired</option>
        </select>
        <button className={`${s.btn} ${s.btnPrimary}`} type="submit">
          Search
        </button>
      </form>
      <div className={s.panel}>
        <JobsTable jobs={rows} />
        <Pager path="/ubaid93/jobs" params={{ q, source, status }} page={page} pageSize={PAGE_SIZE} total={total} />
      </div>
    </>
  )
}
