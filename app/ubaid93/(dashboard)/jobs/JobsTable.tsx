'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { JobRow } from './page'
import JobEditModal from './JobEditModal'

function fmt(n: bigint | number | null, currency: string | null) {
  if (!n) return '—'
  const num = typeof n === 'bigint' ? Number(n) : n
  return `${currency ?? 'USD'}${Math.round(num / 1000)}k`
}

export default function JobsTable({
  jobs: initial, total, page, pageSize, sources, initialQ, initialSource, initialExpired,
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
  const [editingJob, setEditingJob] = useState<JobRow | null>(null)
  const [, startTransition] = useTransition()

  async function toggleExpired(id: string, current: boolean) {
    const res = await fetch('/api/ubaid93/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, isExpired: !current }),
    })
    if (res.ok) setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, isExpired: !current } : j)))
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
    startTransition(() => router.push(`/ubaid93/jobs?${params.toString()}`))
  }

  const inp: React.CSSProperties = {
    padding: '8px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#fff', fontSize: 13,
  }

  return (
    <div>
      {editingJob && (
        <JobEditModal
          job={editingJob}
          onClose={() => setEditingJob(null)}
          onSaved={(updated) => {
            setJobs((prev) => prev.map((j) => j.id === editingJob.id ? { ...j, ...updated } : j))
          }}
        />
      )}

      <form onSubmit={applyFilters} style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input name="q" defaultValue={initialQ} placeholder="Search title or company..." style={{ ...inp, flex: 1, minWidth: 200 }} />
        <select name="source" defaultValue={initialSource} style={inp}>
          <option value="">All sources</option>
          {sources.map((s) => <option key={s.source} value={s.source}>{s.source} ({s.count})</option>)}
        </select>
        <select name="expired" defaultValue={initialExpired} style={inp}>
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
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>Posted</th>
              <th style={{ textAlign: 'left', padding: '10px 8px', fontWeight: 600 }}>Expires</th>
              <th style={{ textAlign: 'right', padding: '10px 8px', fontWeight: 600 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <tr key={job.id} style={{ borderBottom: '1px solid #141414' }}>
                <td style={{ padding: '10px 8px', maxWidth: 320 }}>
                  <div style={{ color: '#fff', fontWeight: 600, marginBottom: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{job.title}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>{job.company}</div>
                  {job.locationRaw && <div style={{ color: '#444', fontSize: 11, marginTop: 1 }}>{job.locationRaw}</div>}
                </td>
                <td style={{ padding: '10px 8px', color: '#a3a3a3', whiteSpace: 'nowrap' }}>{job.source.replace('board:', '')}</td>
                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap' }}>
                  <span style={{ color: '#84cc16' }}>
                    {job.salaryMin || job.salaryMax
                      ? `${fmt(job.salaryMin, job.salaryCurrency)}–${fmt(job.salaryMax, job.salaryCurrency)}`
                      : '—'}
                  </span>
                </td>
                <td style={{ padding: '10px 8px' }}>
                  <span style={{
                    background: job.isExpired ? '#2e1a1a' : '#1a2e1a',
                    color: job.isExpired ? '#f87171' : '#84cc16',
                    borderRadius: 100, padding: '2px 10px', fontSize: 11,
                  }}>{job.isExpired ? 'Expired' : 'Active'}</span>
                </td>
                <td style={{ padding: '10px 8px', color: '#555', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {job.postedAt ? new Date(job.postedAt).toLocaleDateString() : new Date(job.createdAt).toLocaleDateString()}
                </td>
                <td style={{ padding: '10px 8px', whiteSpace: 'nowrap', fontSize: 12 }}>
                  {job.expiresAt
                    ? <span style={{ color: new Date(job.expiresAt) < new Date() ? '#f87171' : '#fbbf24' }}>{new Date(job.expiresAt).toLocaleDateString()}</span>
                    : <span style={{ color: '#333' }}>—</span>}
                </td>
                <td style={{ padding: '10px 8px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                    <button onClick={() => setEditingJob(job)}
                      style={{ padding: '4px 12px', background: '#1a1a1a', color: '#84cc16', border: '1px solid #2a2a2a', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
