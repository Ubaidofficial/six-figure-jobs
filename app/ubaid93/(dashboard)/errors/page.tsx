import { prisma } from '../../../../lib/prisma'
import ErrorLogList from './ErrorLogList'

type SearchParams = Record<string, string | undefined>

export default async function ErrorsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const sp = (await searchParams) || {}
  const page = Math.max(1, Number(sp.page || 1))
  const status = sp.status || ''
  const severity = sp.severity || ''
  const pageSize = 50

  const where: Record<string, unknown> = {}
  if (status) where.status = status
  if (severity) where.severity = severity

  const [items, total, newCount] = await Promise.all([
    prisma.errorLog.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
    prisma.errorLog.count({ where }),
    prisma.errorLog.count({ where: { status: 'new' } }),
  ])

  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Error Log</h1>
      <p style={{ color: '#666', marginBottom: 24 }}>JS errors and unhandled rejections captured from users</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: `All (${total})`, status: '', severity: '' },
          { label: `New (${newCount})`, status: 'new', severity: '' },
          { label: 'Resolved', status: 'resolved', severity: '' },
        ].map((tab) => {
          const active = status === tab.status && severity === tab.severity
          return (
            <a key={tab.label}
              href={tab.status ? `/ubaid93/errors?status=${tab.status}` : '/ubaid93/errors'}
              style={{
                padding: '6px 16px', borderRadius: 100, fontSize: 13, textDecoration: 'none',
                background: active ? '#f87171' : '#1a1a1a',
                color: active ? '#000' : '#a3a3a3',
                fontWeight: active ? 700 : 400,
              }}>
              {tab.label}
            </a>
          )
        })}
      </div>

      <ErrorLogList items={items} total={total} page={page} pageSize={pageSize} />
    </div>
  )
}
