'use client'
// Edit drawer for one job. Loads the job when opened (the list leaves descriptions out). The description preview is a
// sandboxed iframe: descriptions come from other sites, and HTML put straight into this page could run script with
// the admin's session (an <img onerror>, for example).
import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'

import s from '../../admin.module.css'

type Job = {
  id: string
  title: string
  company: string | null
  companyLogo: string | null
  source: string
  locationRaw: string | null
  remoteMode: string | null
  employmentType: string | null
  salaryMin: string | null
  salaryMax: string | null
  salaryCurrency: string | null
  salaryPeriod: string | null
  applyUrl: string | null
  url: string | null
  postedAt: string | null
  expiresAt: string | null
  visaSponsorship: boolean
  descriptionHtml: string | null
}

type Form = Record<
  | 'title' | 'company' | 'companyLogo' | 'locationRaw' | 'remoteMode' | 'employmentType' | 'salaryMin' | 'salaryMax'
  | 'salaryCurrency' | 'salaryPeriod' | 'applyUrl' | 'postedAt' | 'expiresAt' | 'descriptionHtml',
  string
> & { visaSponsorship: boolean }

// The values the site reads (lib/seo/jobJsonLd.ts, filters): other spellings are not recognised as remote or hybrid.
const MODES = [
  ['', 'Not set'],
  ['remote', 'Remote'],
  ['hybrid', 'Hybrid'],
  ['onsite', 'On-site'],
]
const TYPES = ['', 'full-time', 'part-time', 'contract', 'temporary', 'internship']
const day = (v: string | null) => (v ? v.slice(0, 10) : '')

function toForm(j: Job): Form {
  return {
    title: j.title ?? '',
    company: j.company ?? '',
    companyLogo: j.companyLogo ?? '',
    locationRaw: j.locationRaw ?? '',
    remoteMode: j.remoteMode ?? '',
    employmentType: j.employmentType ?? '',
    salaryMin: j.salaryMin ?? '',
    salaryMax: j.salaryMax ?? '',
    salaryCurrency: j.salaryCurrency ?? 'USD',
    salaryPeriod: j.salaryPeriod ?? 'year',
    applyUrl: j.applyUrl ?? '',
    postedAt: day(j.postedAt),
    expiresAt: day(j.expiresAt),
    descriptionHtml: j.descriptionHtml ?? '',
    visaSponsorship: j.visaSponsorship,
  }
}

export default function JobEditDrawer({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const [job, setJob] = useState<Job | null>(null)
  const [meta, setMeta] = useState<{ shownPay: string | null; hasYearlyRange: boolean } | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [preview, setPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Kept in a ref so a parent re-render (a new onClose function) does not reload the job and lose edits.
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    let live = true
    fetch(`/api/ubaid93/jobs?id=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { job: Job; shownPay: string | null; hasYearlyRange: boolean }) => {
        if (!live) return
        setJob(d.job)
        setMeta({ shownPay: d.shownPay, hasYearlyRange: d.hasYearlyRange })
        setForm(toForm(d.job))
      })
      .catch(() => live && setError('Could not load this job.'))
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => {
      live = false
      window.removeEventListener('keydown', onKey)
    }
  }, [id])

  const set = (key: keyof Form, value: string | boolean) => setForm((f) => (f ? { ...f, [key]: value } : f))
  const orNull = (v: string) => (v.trim() ? v.trim() : null)

  async function save() {
    if (!form) return
    setSaving(true)
    setError('')
    const res = await fetch('/api/ubaid93/jobs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        title: form.title.trim(),
        company: orNull(form.company),
        companyLogo: orNull(form.companyLogo),
        locationRaw: orNull(form.locationRaw),
        remoteMode: orNull(form.remoteMode),
        employmentType: orNull(form.employmentType),
        salaryMin: form.salaryMin ? Number(form.salaryMin) : null,
        salaryMax: form.salaryMax ? Number(form.salaryMax) : null,
        salaryCurrency: orNull(form.salaryCurrency),
        salaryPeriod: orNull(form.salaryPeriod),
        applyUrl: orNull(form.applyUrl),
        visaSponsorship: form.visaSponsorship,
        descriptionHtml: orNull(form.descriptionHtml),
        postedAt: form.postedAt ? new Date(form.postedAt).toISOString() : null,
        expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
      }),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d?.error || 'Save failed')
      return
    }
    onSaved()
  }

  const text = (key: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={s.field}>
      {label}
      <input className={s.input} value={form ? (form[key] as string) : ''} onChange={(e) => set(key, e.target.value)} {...props} />
    </label>
  )

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(12,13,14,0.28)', zIndex: 40 }} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Edit job"
        className={s.panel}
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, width: 'min(640px, 100vw)', zIndex: 50, borderRadius: 0,
          display: 'flex', flexDirection: 'column',
        }}
      >
        <div className={s.pageHead} style={{ padding: '18px 20px', margin: 0, borderBottom: '1px solid var(--color-border)' }}>
          <div style={{ minWidth: 0 }}>
            <h2 className={s.sectionTitle} style={{ margin: 0 }}>
              {job?.title ?? 'Loading…'}
            </h2>
            {job ? <div className={`${s.cellSub} ${s.mono}`}>{job.source} · {job.id}</div> : null}
          </div>
          <button className={s.btn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
          {error && !form ? <p className={s.error}>{error}</p> : null}
          {form && meta ? (
            <>
              {text('title', 'Title')}
              <div className={s.grid2}>
                {text('company', 'Company')}
                {text('companyLogo', 'Logo URL', { type: 'url' })}
              </div>
              <div className={s.grid2}>
                {text('locationRaw', 'Location')}
                <label className={s.field}>
                  Work arrangement
                  <select className={s.select} value={form.remoteMode} onChange={(e) => set('remoteMode', e.target.value)}>
                    {MODES.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                    {form.remoteMode && !MODES.some(([v]) => v === form.remoteMode) ? (
                      <option value={form.remoteMode}>{form.remoteMode} (not recognised)</option>
                    ) : null}
                  </select>
                </label>
              </div>
              <div className={s.grid2}>
                <label className={s.field}>
                  Employment type
                  <select className={s.select} value={form.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
                    {TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t || 'Not set'}
                      </option>
                    ))}
                    {form.employmentType && !TYPES.includes(form.employmentType) ? (
                      <option value={form.employmentType}>{form.employmentType}</option>
                    ) : null}
                  </select>
                </label>
                <label className={s.field} style={{ alignContent: 'end' }}>
                  <span>
                    <input
                      type="checkbox"
                      checked={form.visaSponsorship}
                      onChange={(e) => set('visaSponsorship', e.target.checked)}
                      style={{ marginRight: 8 }}
                    />
                    Sponsors visas
                  </span>
                </label>
              </div>

              <div className={s.notice} style={{ margin: '4px 0 14px' }}>
                Pay on the job page: <strong className={s.mono}>{meta.shownPay ?? 'not shown'}</strong>.{' '}
                {meta.hasYearlyRange
                  ? 'It comes from the yearly range read at import, so the source pay below does not change it.'
                  : 'This job has no yearly range, so the source pay below is what the page uses.'}
              </div>
              <div className={s.grid2}>
                {text('salaryMin', 'Source pay, from', { inputMode: 'numeric' })}
                {text('salaryMax', 'Source pay, to', { inputMode: 'numeric' })}
              </div>
              <div className={s.grid2}>
                {text('salaryCurrency', 'Currency (ISO code)', { maxLength: 3 })}
                <label className={s.field}>
                  Period
                  <select className={s.select} value={form.salaryPeriod} onChange={(e) => set('salaryPeriod', e.target.value)}>
                    {['year', 'month', 'hour'].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {text('applyUrl', 'Apply URL', { type: 'url' })}
              <div className={s.grid2}>
                {text('postedAt', 'Posted', { type: 'date' })}
                {text('expiresAt', 'Expires', { type: 'date' })}
              </div>

              <div className={s.toolbar} style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span className={s.figureLabel}>Description (HTML)</span>
                <div className={s.tabs}>
                  <button type="button" className={s.tab} aria-current={!preview ? 'page' : undefined} onClick={() => setPreview(false)}>
                    Edit
                  </button>
                  <button type="button" className={s.tab} aria-current={preview ? 'page' : undefined} onClick={() => setPreview(true)}>
                    Preview
                  </button>
                </div>
              </div>
              {preview ? (
                <iframe
                  title="Description preview"
                  sandbox=""
                  srcDoc={`<!doctype html><meta charset="utf-8"><style>body{font:14px/1.55 system-ui,sans-serif;color:#0c0d0e;margin:12px}</style>${form.descriptionHtml}`}
                  style={{ width: '100%', height: 360, border: '1px solid var(--color-border)', borderRadius: 8, background: '#fff' }}
                />
              ) : (
                <textarea
                  className={s.input}
                  style={{ width: '100%', minHeight: 360, padding: 10, fontFamily: 'var(--font-mono)', fontSize: 12 }}
                  value={form.descriptionHtml}
                  onChange={(e) => set('descriptionHtml', e.target.value)}
                />
              )}
            </>
          ) : null}
        </div>

        <div className={s.toolbar} style={{ margin: 0, padding: '12px 20px', borderTop: '1px solid var(--color-border)', justifyContent: 'space-between' }}>
          <span>
            {job?.url ? (
              <a className={s.link} href={job.url} target="_blank" rel="noopener noreferrer">
                Original posting ↗
              </a>
            ) : null}
          </span>
          <span className={s.actions}>
            {error && form ? <span className={s.error} style={{ margin: 0 }}>{error}</span> : null}
            <button className={s.btn} onClick={onClose}>
              Cancel
            </button>
            <button className={`${s.btn} ${s.btnPrimary}`} disabled={!form || saving || !form.title.trim()} onClick={save}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </span>
        </div>
      </aside>
    </>
  )
}
