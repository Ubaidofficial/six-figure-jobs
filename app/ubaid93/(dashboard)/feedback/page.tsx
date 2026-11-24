import { JOB_REPORT_TYPES, reportedJobId } from '../../../../lib/admin/jobReports'
import { buildJobSlugHref } from '../../../../lib/jobs/jobSlug'
import { buildSalaryText } from '../../../../lib/jobs/salary'
import { prisma } from '../../../../lib/prisma'
import { PageHead, Pager, Tabs, hrefWith, intParam, s } from '../ui'
import FeedbackList, { type ReportedJob } from './FeedbackList'
import { requireAdmin } from '../requireAdmin'

export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'reviewed', 'resolved'] as const
const PAGE_SIZE = 30

export default async function FeedbackPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  await requireAdmin()
  const sp = (await searchParams) || {}
  const page = intParam(sp.page, 1, 1, 1000)
  const status = (STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as string) : ''
  const kind = sp.kind === 'reports' ? 'reports' : ''

  const where = { ...(status ? { status } : {}), ...(kind ? { type: { in: JOB_REPORT_TYPES } } : {}) }
  const [items, total, counts, openReports] = await Promise.all([
    prisma.feedback.findMany({
      where,
      select: { id: true, type: true, message: true, url: true, hasScreenshot: true, userAgent: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.feedback.count({ where }),
    prisma.feedback.groupBy({ by: ['status'], where: kind ? { type: { in: JOB_REPORT_TYPES } } : {}, _count: { _all: true } }),
    // Open reports, to say "3 open reports on this job" and to count the jobs with any.
    prisma.feedback.findMany({
      where: { type: { in: JOB_REPORT_TYPES }, status: { not: 'resolved' } },
      select: { type: true, message: true },
      take: 5000,
    }),
  ])
  const by = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>
  const all = counts.reduce((n, c) => n + c._count._all, 0)

  const openPerJob = new Map<string, number>()
  for (const r of openReports) {
    const id = reportedJobId(r.type, r.message)
    if (id) openPerJob.set(id, (openPerJob.get(id) ?? 0) + 1)
  }
  const ids = [...new Set(items.map((i) => reportedJobId(i.type, i.message)).filter((x): x is string => Boolean(x)))]
  const jobs = ids.length
    ? await prisma.job.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, shortId: true, title: true, company: true, source: true, isExpired: true,
          minAnnual: true, maxAnnual: true, currency: true, salaryMin: true, salaryMax: true, salaryCurrency: true,
          salaryPeriod: true, applyUrl: true,
        },
      })
    : []
  const jobMap: Record<string, ReportedJob> = Object.fromEntries(
    jobs.map((j) => [
      j.id,
      {
        id: j.id,
        title: j.title,
        company: j.company,
        source: j.source.replace(/^board:/, ''),
        isExpired: j.isExpired,
        pay: buildSalaryText(j as Parameters<typeof buildSalaryText>[0]),
        href: buildJobSlugHref(j),
        applyUrl: j.applyUrl,
        openReports: openPerJob.get(j.id) ?? 0,
      },
    ]),
  )

  return (
    <>
      <PageHead
        title="Feedback"
        lede="Messages from the Feedback tab and reports from “Report this job”. A job report shows the job, so you can fix or expire it here."
      />
      <div className={s.toolbar}>
        <Tabs
          label="Status"
          current={status}
          items={[
            { label: 'All', value: '', href: hrefWith('/ubaid93/feedback', { kind }), count: all },
            ...STATUSES.map((st) => ({
              label: st[0].toUpperCase() + st.slice(1),
              value: st,
              href: hrefWith('/ubaid93/feedback', { status: st, kind }),
              count: by[st] ?? 0,
            })),
          ]}
        />
        <Tabs
          label="Kind"
          current={kind}
          items={[
            { label: 'Everything', value: '', href: hrefWith('/ubaid93/feedback', { status }) },
            { label: 'Job reports', value: 'reports', href: hrefWith('/ubaid93/feedback', { status, kind: 'reports' }), count: openReports.length },
          ]}
        />
      </div>
      <div className={s.panel}>
        <FeedbackList items={items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString(), jobId: reportedJobId(i.type, i.message) }))} jobs={jobMap} />
        {total > PAGE_SIZE ? <Pager path="/ubaid93/feedback" params={{ status, kind }} page={page} pageSize={PAGE_SIZE} total={total} /> : null}
      </div>
    </>
  )
}
