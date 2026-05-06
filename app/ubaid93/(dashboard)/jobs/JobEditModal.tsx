'use client'
import { useState, useTransition } from 'react'
import type { JobRow } from './page'

const inp: React.CSSProperties = {
  width: '100%', padding: '8px 12px', background: '#1a1a1a', border: '1px solid #2a2a2a',
  borderRadius: 8, color: '#fff', fontSize: 13, boxSizing: 'border-box',
}
const label: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#666', marginBottom: 4, fontWeight: 500,
}
const field: React.CSSProperties = { marginBottom: 14 }

interface EditState {
  title: string
  company: string
  locationRaw: string
  remoteMode: string
  employmentType: string
  salaryMin: string
  salaryMax: string
  salaryCurrency: string
  salaryPeriod: string
  applyUrl: string
  postedAt: string
  expiresAt: string
  visaSponsorship: boolean
  descriptionHtml: string
}

export default function JobEditModal({
  job,
  onClose,
  onSaved,
}: {
  job: JobRow
  onClose: () => void
  onSaved: (updated: Partial<JobRow>) => void
}) {
  const [data, setData] = useState<EditState>({
    title: job.title ?? '',
    company: job.company ?? '',
    locationRaw: job.locationRaw ?? '',
    remoteMode: job.remoteMode ?? '',
    employmentType: job.employmentType ?? '',
    salaryMin: job.salaryMin != null ? String(job.salaryMin) : '',
    salaryMax: job.salaryMax != null ? String(job.salaryMax) : '',
    salaryCurrency: job.salaryCurrency ?? 'USD',
    salaryPeriod: job.salaryPeriod ?? 'year',
    applyUrl: job.applyUrl ?? '',
    postedAt: job.postedAt ? new Date(job.postedAt).toISOString().slice(0, 10) : '',
    expiresAt: job.expiresAt ? new Date(job.expiresAt).toISOString().slice(0, 10) : '',
    visaSponsorship: job.visaSponsorship ?? false,
    descriptionHtml: job.descriptionHtml ?? '',
  })
  const [saving, startSave] = useTransition()
  const [error, setError] = useState('')

  function set(key: keyof EditState, value: string | boolean) {
    setData((d) => ({ ...d, [key]: value }))
  }

  function save() {
    startSave(async () => {
      setError('')
      const body: Record<string, unknown> = {
        id: job.id,
        title: data.title,
        company: data.company,
        locationRaw: data.locationRaw || null,
        remoteMode: data.remoteMode || null,
        employmentType: data.employmentType || null,
        salaryCurrency: data.salaryCurrency || null,
        salaryPeriod: data.salaryPeriod || null,
        applyUrl: data.applyUrl || null,
        visaSponsorship: data.visaSponsorship,
        descriptionHtml: data.descriptionHtml || null,
      }
      if (data.salaryMin) body.salaryMin = Number(data.salaryMin)
      else body.salaryMin = null
      if (data.salaryMax) body.salaryMax = Number(data.salaryMax)
      else body.salaryMax = null
      if (data.postedAt) body.postedAt = new Date(data.postedAt).toISOString()
      else body.postedAt = null
      if (data.expiresAt) body.expiresAt = new Date(data.expiresAt).toISOString()
      else body.expiresAt = null

      const res = await fetch('/api/ubaid93/jobs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d?.error || 'Save failed')
        return
      }
      onSaved({
        title: data.title,
        company: data.company,
        locationRaw: data.locationRaw || null,
        remoteMode: data.remoteMode || null,
        employmentType: data.employmentType || null,
        salaryMin: data.salaryMin ? BigInt(data.salaryMin) : null,
        salaryMax: data.salaryMax ? BigInt(data.salaryMax) : null,
        salaryCurrency: data.salaryCurrency || null,
        salaryPeriod: data.salaryPeriod || null,
        applyUrl: data.applyUrl || null,
        visaSponsorship: data.visaSponsorship,
        descriptionHtml: data.descriptionHtml || null,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
      })
      onClose()
    })
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 40,
      }} />

      {/* Drawer */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 560,
        background: '#0f0f0f', borderLeft: '1px solid #1f1f1f',
        zIndex: 50, display: 'flex', flexDirection: 'column', overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #1f1f1f', flexShrink: 0 }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16 }}>Edit Job</div>
            <div style={{ color: '#555', fontSize: 12, marginTop: 2 }}>{job.id}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, cursor: 'pointer', padding: 4 }}>✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px', flex: 1 }}>
          <div style={field}>
            <label style={label}>Job Title</label>
            <input style={inp} value={data.title} onChange={(e) => set('title', e.target.value)} />
          </div>

          <div style={field}>
            <label style={label}>Company</label>
            <input style={inp} value={data.company} onChange={(e) => set('company', e.target.value)} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={label}>Location</label>
              <input style={inp} value={data.locationRaw} onChange={(e) => set('locationRaw', e.target.value)} placeholder="e.g. New York, NY" />
            </div>
            <div>
              <label style={label}>Remote Mode</label>
              <select style={inp} value={data.remoteMode} onChange={(e) => set('remoteMode', e.target.value)}>
                <option value="">— unset —</option>
                <option value="fully-remote">Fully Remote</option>
                <option value="hybrid">Hybrid</option>
                <option value="on-site">On-site</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={label}>Employment Type</label>
              <select style={inp} value={data.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                <option value="">— unset —</option>
                <option value="full-time">Full-time</option>
                <option value="part-time">Part-time</option>
                <option value="contract">Contract</option>
                <option value="freelance">Freelance</option>
                <option value="internship">Internship</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingTop: 20 }}>
              <input type="checkbox" id="visa" checked={data.visaSponsorship}
                onChange={(e) => set('visaSponsorship', e.target.checked)}
                style={{ width: 16, height: 16, cursor: 'pointer' }} />
              <label htmlFor="visa" style={{ ...label, margin: 0, color: '#a3a3a3', cursor: 'pointer' }}>Visa Sponsorship</label>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px 80px', gap: 8, marginBottom: 14 }}>
            <div>
              <label style={label}>Salary Min</label>
              <input style={inp} value={data.salaryMin} onChange={(e) => set('salaryMin', e.target.value)} placeholder="100000" type="number" />
            </div>
            <div>
              <label style={label}>Salary Max</label>
              <input style={inp} value={data.salaryMax} onChange={(e) => set('salaryMax', e.target.value)} placeholder="150000" type="number" />
            </div>
            <div>
              <label style={label}>Currency</label>
              <select style={inp} value={data.salaryCurrency} onChange={(e) => set('salaryCurrency', e.target.value)}>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
                <option value="AUD">AUD</option>
              </select>
            </div>
            <div>
              <label style={label}>Period</label>
              <select style={inp} value={data.salaryPeriod} onChange={(e) => set('salaryPeriod', e.target.value)}>
                <option value="year">Year</option>
                <option value="month">Month</option>
                <option value="hour">Hour</option>
              </select>
            </div>
          </div>

          <div style={field}>
            <label style={label}>Apply URL</label>
            <input style={inp} value={data.applyUrl} onChange={(e) => set('applyUrl', e.target.value)} placeholder="https://..." />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
            <div>
              <label style={label}>Posted Date</label>
              <input style={inp} type="date" value={data.postedAt} onChange={(e) => set('postedAt', e.target.value)} />
            </div>
            <div>
              <label style={label}>Expiry Date</label>
              <input style={inp} type="date" value={data.expiresAt} onChange={(e) => set('expiresAt', e.target.value)} />
            </div>
          </div>

          <div style={field}>
            <label style={label}>Description (HTML)</label>
            <textarea
              style={{ ...inp, minHeight: 200, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.5 }}
              value={data.descriptionHtml}
              onChange={(e) => set('descriptionHtml', e.target.value)}
              placeholder="<p>Job description...</p>"
            />
          </div>

          {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ padding: '16px 24px', borderTop: '1px solid #1f1f1f', display: 'flex', gap: 10, flexShrink: 0 }}>
          <button onClick={save} disabled={saving} style={{
            flex: 1, padding: '10px', background: '#84cc16', color: '#000',
            fontWeight: 700, border: 'none', borderRadius: 8, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 14,
          }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          <button onClick={onClose} style={{
            padding: '10px 20px', background: '#1a1a1a', color: '#a3a3a3',
            border: '1px solid #2a2a2a', borderRadius: 8, cursor: 'pointer', fontSize: 14,
          }}>
            Cancel
          </button>
        </div>
      </div>
    </>
  )
}
