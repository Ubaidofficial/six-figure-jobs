'use client'
import { useState } from 'react'

type ErrorItem = {
  id: string
  message: string
  stack: string | null
  url: string | null
  userAgent: string | null
  context: string | null
  severity: string
  status: string
  createdAt: Date | string
}

export default function ErrorLogList({ items: initial, total, page, pageSize }: {
  items: ErrorItem[]
  total: number
  page: number
  pageSize: number
}) {
  const [items, setItems] = useState(initial)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function resolve(id: string) {
    const res = await fetch('/api/ubaid93/errors', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: 'resolved' }),
    })
    if (res.ok) setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: 'resolved' } : i))
  }

  if (items.length === 0) {
    return <p style={{ color: '#555', padding: '40px 0', textAlign: 'center' }}>No errors logged. Great!</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <div key={item.id} style={{ background: '#111', border: `1px solid ${item.status === 'new' ? '#3a1a1a' : '#1f1f1f'}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <span style={{
                background: item.severity === 'error' ? '#3a1a1a' : '#1a2e1a',
                color: item.severity === 'error' ? '#f87171' : '#84cc16',
                borderRadius: 100, padding: '2px 10px', fontSize: 11, whiteSpace: 'nowrap', flexShrink: 0,
              }}>{item.severity}</span>
              <span style={{ color: '#fff', fontSize: 13, fontWeight: 600, flex: 1, wordBreak: 'break-word' }}>{item.message}</span>
              <span style={{ color: '#555', fontSize: 11, whiteSpace: 'nowrap' }}>{new Date(item.createdAt).toLocaleString()}</span>
            </div>

            {item.url && (
              <div style={{ color: '#60a5fa', fontSize: 12, marginTop: 6, wordBreak: 'break-all' }}>{item.url}</div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {item.stack && (
                <button onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  style={{ padding: '3px 10px', background: '#1a1a1a', border: 'none', borderRadius: 6, color: '#a3a3a3', fontSize: 11, cursor: 'pointer' }}>
                  {expanded === item.id ? 'Hide stack' : 'Show stack'}
                </button>
              )}
              {item.status !== 'resolved' && (
                <button onClick={() => resolve(item.id)}
                  style={{ padding: '3px 10px', background: '#1a1a1a', border: 'none', borderRadius: 6, color: '#555', fontSize: 11, cursor: 'pointer' }}>
                  Resolve
                </button>
              )}
              {item.status === 'resolved' && (
                <span style={{ fontSize: 11, color: '#555' }}>✓ resolved</span>
              )}
            </div>

            {expanded === item.id && item.stack && (
              <pre style={{
                marginTop: 10, padding: '10px 14px', background: '#0a0a0a', borderRadius: 8,
                fontSize: 11, color: '#a3a3a3', overflow: 'auto', maxHeight: 300, whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>{item.stack}</pre>
            )}
          </div>
        ))}
      </div>

      {Math.ceil(total / pageSize) > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 32 }}>
          {page > 1 && <a href={`?page=${page - 1}`} style={{ color: '#84cc16' }}>← Prev</a>}
          <span style={{ color: '#555' }}>Page {page} of {Math.ceil(total / pageSize)}</span>
          {page < Math.ceil(total / pageSize) && <a href={`?page=${page + 1}`} style={{ color: '#84cc16' }}>Next →</a>}
        </div>
      )}
    </div>
  )
}
