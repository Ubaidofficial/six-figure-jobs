'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { JobRow } from './page'

function fmt(n: bigint | number | null, currency: string | null) {
  if (!n) return '—'
  const num = typeof n === 'bigint' ? Number(n) : n
  return `${currency ?? '$'}${Math.round(num / 1000)}k`
}

export default function JobsTable({
  jobs: initial,
  total,
  page,
  pageSize,
  sources,
  initialQ,
  initialSource,
  initialExpired,
}: {
  jobs: JobRow[]
  total: number
  page: number
  pageSize: number
  sources: { source: string; count: number }[]
  initialQ: string
  initialSource: string
  initialExpired: string
}) {
  const router = useRouter()
  const [jobs, setJobs] = useState(initial)
  const [editing, setEditing] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [saving, startSave] = useTransition()

  function startEdit(job: JobRow) {
    setEditing(job.id)
    setEditData({
      title: job.title,
      company: job.company ?? '',
      salaryMin: job.salaryMin ? String(job.salaryMin) : '',
      salaryMax: job.salaryMax ? String(job.salaryMax) : '',
      applyUrl: job.applyUrl ?? '',
    })
  }

  function saveEdit(id: string) {
    startSave(async () => {
      const body: Record<string, unknown> = {
        id,
        title: editData.title,
        company: editData.company,
        applyUrl: editData.applyUrl || null,
      }
      if (editData.salaryMin) body.salaryMin = Number(editData.salaryMin)
      if (editData.salaryMax) body.salaryMax = Number(editData.salaryMax)

      const res = await fetch('/api/admin/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === id
              ? {
                  ...j,
                  title: editData.title,
                  company: editData.company,
                  applyUrl: editData.applyUrl || null,
                  salaryMin: editData.salaryMin ? BigInt(editData.salaryMin) : null,
                  salaryMax: editData.salaryMax ? BigInt(editData.salaryMax) : null,
                }
              : j
          )
        )
        setEditing(null)
      }
    })
  }

  async function toggleExpired(id: string, current: boolean) {
    const res = await fetch('/api/admin/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isExpired: !current }),
    })
    if (res.ok) {
      setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, isExpired: !current } : j)))
    }
  }

  function applyFilters(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const params = new URLSearchParams()
    const q = fd.get('q') as string
    const source = fd.get('source') as string
    const expired = fd.get('expired') as string
    if (q) params.set('q', q)
    if (source) params.set('source', source)
    if (expired) params.set('expired', expired)
    router.push(`/admin/jobs?${params.toString()}`)
  }

  const totalPages = Math.ceil(total / pageSize)

  const input: React.CSSProperties = {
    padding: '8px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#fff', fontSize: 13,
  }

  return (
    <div>
      <form onSubmit={applyFilters} style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input name="q" defaultValue={initialQ} placeholder="Search title or company..." style={{ ...input, flex: 1, minWidth: 200 }} />
        <select name="source" defaultValue={initialSource} style={input}>
          <option value="">All sources</option>
          {sources.map((s) => (
            <option key={s.source} value={s.source}>{s.source} ({s.count})</option>
          ))}
        </select>
        <select name="expired" defaultValue={initialExpired} style={input}>
          <option value="">All jobs</option>
          <option value="0">Active only</option>
          <option value="1">Expired only</option>
        </select>
        <button type="submit" style={{ padding: '8px 20px', background: '#84cc16', color: '#000', fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
          Filter
        </button>
      </form>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1f1f1f', color: '#555' }}>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>Title / Company</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>Source</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>Salary</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>Status</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>Added</th>
              <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} style={{ borderBottom: '1px solid #141414' }}>
                <td style={{ padding: '10px 8px' }}>
                  {editing === job.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <input value={editData.title} onChange={(e) => setEditData((d) => ({ ...d, title: e.target.value }))}
                        style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
                      <input value={editData.company} onChange={(e) => setEditData((d) => ({ ...d, company: e.target.value }))}
                        placeholder="Company" style={{ ...input, width: '100%', boxSizing: 'border-box' }} />
                    </div>
                  ) : (
                    <>
                      <div style={{ color: '#fff', fontWeight: 600, marginBottom: 2 }}>{job.title}</div>
                      <div style={{ color: '#666' }}>{job.company}</div>
                    </>
                  )}
                </td>
                <td style={{ padding: '10px 8px', color: '#a3a3a3' }}>{job.source.replace('board:', '')}</td>
                <td style={{ padding: '10px 8px' }}>
                  {editing === job.id ? (
                    <div style={{ display: 'flex', gap: 4 }}>
                      <input value={editData.salaryMin} onChange={(e) => setEditData((d) => ({ ...d, salaryMin: e.target.value }))}
                        placeholder="Min" style={{ ...input, width: 70 }} />
                      <input value={editData.salaryMax} onChange={(e) => setEditData((d) => ({ ...d, salaryMax: e.target.value }))}
                        placeholder="Max" style={{ ...input, width: 70 }} />
                    </div>
                  ) : (
                    <span style={{ color: '#84cc16' }}>
                      {job.salaryMin || job.salaryMax
                        ? `${fmt(job.salaryMin, job.salaryCurrency)}–${fmt(job.salaryMax, job.salaryCurrency)}`
                        : '—'}
                    </span>
                  )}
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{
                    background: job.isExpired ? '#2e1a1a' : '#1a2e1a',
                    color: job.isExpired ? '#f87171' : '#84cc16',
                    borderRadius: 100, padding: '2px 10px', fontSize: 11,
                  }}>{job.isExpired ? 'Expired' : 'Active'}</span>
                </td>
                <td style={{ padding: '10px 8px', color: '#555' }}>
                  {new Date(job.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right' }}>
                  {editing === job.id ? (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => saveEdit(job.id)} disabled={saving}
                        style={{ padding: '4px 10px', background: '#84cc16', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>
                        Save
                      </button>
                      <button onClick={() => setEditing(null)}
                        style={{ padding: '4px 10px', background: '#1a1a1a', color: '#a3a3a3', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      <button onClick={() => startEdit(job)}
                        style={{ padding: '4px 10px', background: '#1a1a1a', color: '#a3a3a3', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        Edit
                      </button>
                      <button onClick={() => toggleExpired(job.id, job.isExpired)}
                        style={{ padding: '4px 10px', background: '#1a1a1a', color: job.isExpired ? '#84cc16' : '#f87171', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 12 }}>
                        {job.isExpired ? 'Restore' : 'Expire'}
                      </button>
                      {job.applyUrl && (
                        <a href={job.applyUrl} target="_blank" rel="noopener"
                          style={{ padding: '4px 10px', background: '#1a1f2e', color: '#60a5fa', borderRadius: 6, fontSize: 12, textDecoration: 'none' }}>
                          Apply ↗
                        </a>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 32 }}>
          {page > 1 && <a href={`?page=${page - 1}`} style={{ color: '#84cc16' }}>← Prev</a>}
          <span style={{ color: '#555' }}>Page {page} of {totalPages}</span>
          {page < totalPages && <a href={`?page=${page + 1}`} style={{ color: '#84cc16' }}>Next →</a>}
        </div>
      )}
    </div>
  )
}
