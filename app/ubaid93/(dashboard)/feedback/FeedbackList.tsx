'use client'
import { useState } from 'react'

const TYPE_LABELS: Record<string, string> = {
  bug: '🐛 Bug',
  'broken-link': '🔗 Broken link',
  'wrong-salary': '💰 Wrong salary',
  'wrong-logo': '🖼 Wrong logo',
  suggestion: '💡 Suggestion',
  other: '📝 Other',
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  new: { bg: '#1a2e1a', color: '#84cc16' },
  reviewed: { bg: '#1a1f2e', color: '#60a5fa' },
  resolved: { bg: '#1f1f1f', color: '#555' },
}

type FeedbackItem = {
  id: string
  type: string
  message: string
  url: string | null
  hasScreenshot: boolean
  userAgent: string | null
  status: string
  createdAt: Date | string
}

export default function FeedbackList({
  items: initial,
  total,
  page,
  pageSize,
}: {
  items: FeedbackItem[]
  total: number
  page: number
  pageSize: number
}) {
  const [items, setItems] = useState(initial)

  async function setStatus(id: string, status: string) {
    const res = await fetch('/api/ubaid93/feedback', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })
    if (res.ok) {
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)))
    }
  }

  if (items.length === 0) {
    return <p style={{ color: '#555', padding: '40px 0', textAlign: 'center' }}>No feedback submissions found.</p>
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item) => {
          const sc = STATUS_COLORS[item.status] ?? STATUS_COLORS.new
          return (
            <div
              key={item.id}
              style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '18px 20px' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10, flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 600, color: '#fff', fontSize: 14 }}>
                  {TYPE_LABELS[item.type] ?? item.type}
                </span>
                <span style={{ background: sc.bg, color: sc.color, borderRadius: 100, padding: '2px 10px', fontSize: 11 }}>
                  {item.status}
                </span>
                {item.hasScreenshot && (
                  <span style={{ background: '#1f1f1f', color: '#a3a3a3', borderRadius: 100, padding: '2px 10px', fontSize: 11 }}>
                    📎 screenshot
                  </span>
                )}
                <span style={{ color: '#555', fontSize: 12, marginLeft: 'auto' }}>
                  {new Date(item.createdAt).toLocaleString()}
                </span>
              </div>

              <p style={{ color: '#d4d4d4', fontSize: 14, lineHeight: 1.6, margin: '0 0 10px', whiteSpace: 'pre-wrap' }}>
                {item.message}
              </p>

              {item.url && (
                <a href={item.url} target="_blank" rel="noopener" style={{ color: '#60a5fa', fontSize: 12, display: 'block', marginBottom: 12 }}>
                  {item.url}
                </a>
              )}

              <div style={{ display: 'flex', gap: 8 }}>
                {item.status !== 'reviewed' && (
                  <button onClick={() => setStatus(item.id, 'reviewed')} style={btnStyle('#1a1f2e', '#60a5fa')}>
                    Mark reviewed
                  </button>
                )}
                {item.status !== 'resolved' && (
                  <button onClick={() => setStatus(item.id, 'resolved')} style={btnStyle('#1f1f1f', '#555')}>
                    Resolve
                  </button>
                )}
                {item.status !== 'new' && (
                  <button onClick={() => setStatus(item.id, 'new')} style={btnStyle('#1a2e1a', '#84cc16')}>
                    Mark new
                  </button>
                )}
              </div>
            </div>
          )
        })}
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

function btnStyle(bg: string, color: string): React.CSSProperties {
  return {
    padding: '5px 12px', background: bg, border: 'none', borderRadius: 6,
    color, fontSize: 12, cursor: 'pointer', fontWeight: 500,
  }
}
