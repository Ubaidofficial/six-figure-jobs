import { prisma } from '../../../../lib/prisma'
import { PageHead, Pager, Tabs, hrefWith, intParam, s } from '../ui'
import FeedbackList from './FeedbackList'

export const dynamic = 'force-dynamic'

const STATUSES = ['new', 'reviewed', 'resolved'] as const
const PAGE_SIZE = 30

export default async function FeedbackPage({ searchParams }: { searchParams?: Promise<Record<string, string | undefined>> }) {
  const sp = (await searchParams) || {}
  const page = intParam(sp.page, 1, 1, 1000)
  const status = (STATUSES as readonly string[]).includes(sp.status ?? '') ? (sp.status as string) : ''

  const where = status ? { status } : {}
  const [items, total, counts] = await Promise.all([
    prisma.feedback.findMany({
      where,
      select: { id: true, type: true, message: true, url: true, hasScreenshot: true, userAgent: true, status: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.feedback.count({ where }),
    prisma.feedback.groupBy({ by: ['status'], _count: { _all: true } }),
  ])
  const by = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<string, number>
  const all = counts.reduce((n, c) => n + c._count._all, 0)

  return (
    <>
      <PageHead title="Feedback" lede="Messages and job reports sent from the Feedback tab on the site." />
      <div className={s.toolbar}>
        <Tabs
          current={status}
          items={[
            { label: 'All', value: '', href: '/ubaid93/feedback', count: all },
            ...STATUSES.map((st) => ({
              label: st[0].toUpperCase() + st.slice(1),
              value: st,
              href: hrefWith('/ubaid93/feedback', { status: st }),
              count: by[st] ?? 0,
            })),
          ]}
        />
      </div>
      <div className={s.panel}>
        <FeedbackList items={items.map((i) => ({ ...i, createdAt: i.createdAt.toISOString() }))} />
        {total > PAGE_SIZE ? <Pager path="/ubaid93/feedback" params={{ status }} page={page} pageSize={PAGE_SIZE} total={total} /> : null}
      </div>
    </>
  )
}
