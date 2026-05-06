import { prisma } from '../../../lib/prisma'
import FeedbackList from './FeedbackList'

type SearchParams = Record<string, string | undefined>

export default async function FeedbackPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = (await searchParams) || {}
  const page = Math.max(1, Number(sp.page || 1))
  const status = sp.status || ''
  const pageSize = 50

  const where = status ? { status } : {}
  const [items, total, newCount, resolvedCount] = await Promise.all([
    prisma.feedback.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.feedback.count({ where }),
    prisma.feedback.count({ where: { status: 'new' } }),
    prisma.feedback.count({ where: { status: 'resolved' } }),
  ])

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Feedback</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>User-submitted feedback and bug reports</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[
          { label: `All (${total})`, value: '' },
          { label: `New (${newCount})`, value: 'new' },
          { label: `Reviewed`, value: 'reviewed' },
          { label: `Resolved (${resolvedCount})`, value: 'resolved' },
        ].map((tab) => (
          <a
            key={tab.value}
            href={tab.value ? `/ubaid93/feedback?status=${tab.value}` : '/ubaid93/feedback'}
            style={{
              padding: '6px 16px', borderRadius: 100, fontSize: 13, textDecoration: 'none',
              background: status === tab.value ? '#84cc16' : '#1a1a1a',
              color: status === tab.value ? '#000' : '#a3a3a3',
              fontWeight: status === tab.value ? 700 : 400,
              border: '1px solid transparent',
            }}
          >
            {tab.label}
          </a>
        ))}
      </div>

      <FeedbackList items={items} total={total} page={page} pageSize={pageSize} />
    </div>
  )
}
