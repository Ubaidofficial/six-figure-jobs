// Shared pieces of the admin console's pages. Server components (no hooks), styled by ../admin.module.css.
import Link from 'next/link'

import s from '../admin.module.css'
import { since } from '../../../lib/admin/timeAgo'
import { Sparkline } from './visuals'

export { s }

export type Tone = 'ok' | 'warn' | 'bad' | 'muted'

export function PageHead({ title, lede, actions }: { title: string; lede?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className={s.pageHead}>
      <div>
        <h1 className={s.title}>{title}</h1>
        {lede ? <p className={s.lede}>{lede}</p> : null}
      </div>
      {actions ? <div className={s.toolbar} style={{ marginBottom: 0 }}>{actions}</div> : null}
    </header>
  )
}

export function Section({ title, note, children }: { title: string; note?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className={s.section}>
      <h2 className={s.sectionTitle}>
        {title}
        {note ? <span className={s.sectionNote}>{note}</span> : null}
      </h2>
      {children}
    </section>
  )
}

/** A row of figures in one panel; a figure with `spark` shows its recent trend (oldest to newest) under the number. */
export function Figures({ items }: { items: Array<{ label: string; value: React.ReactNode; sub?: React.ReactNode; spark?: number[] }> }) {
  return (
    <div className={`${s.panel} ${s.figures}`}>
      {items.map((f) => (
        <div key={f.label} className={s.figure}>
          <div className={s.figureLabel}>{f.label}</div>
          <div className={s.figureValue}>{f.value}</div>
          {f.sub ? <div className={s.figureSub}>{f.sub}</div> : null}
          {f.spark ? (
            <div className={s.spark}>
              <Sparkline values={f.spark} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  )
}

export function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`${s.status} ${s[tone]}`}>{children}</span>
}

/** Filter links that look like a segmented control; `current` is the active value. */
export function Tabs({
  items,
  current,
  label = 'Filter',
}: {
  items: Array<{ label: string; href: string; value: string; count?: number }>
  current: string
  label?: string
}) {
  return (
    <nav className={s.tabs} aria-label={label}>
      {items.map((t) => (
        <Link key={t.value || 'all'} href={t.href} className={s.tab} aria-current={t.value === current ? 'page' : undefined}>
          {t.label}
          {t.count != null ? <span className={s.tabCount}>{t.count.toLocaleString()}</span> : null}
        </Link>
      ))}
    </nav>
  )
}

/** Builds a link to `path` with the given query parameters, leaving out empty ones. */
export function hrefWith(path: string, params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  const qs = q.toString()
  return qs ? `${path}?${qs}` : path
}

/** Previous / next page links that keep the page's other filters (the old pager dropped them). */
export function Pager({
  path,
  params,
  page,
  pageSize,
  total,
}: {
  path: string
  params: Record<string, string | undefined>
  page: number
  pageSize: number
  total: number
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  return (
    <div className={s.pager}>
      <span>
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <span className={s.actions}>
        {page > 1 ? (
          <Link className={s.btn} href={hrefWith(path, { ...params, page: page - 1 })}>
            Previous
          </Link>
        ) : null}
        {page < pages ? (
          <Link className={s.btn} href={hrefWith(path, { ...params, page: page + 1 })}>
            Next
          </Link>
        ) : null}
      </span>
    </div>
  )
}

/** "4 min ago", "3 h ago", "2 days ago"; "–" for no date. The same wording as the health checks and alert emails. */
export function ago(date: Date | string | null | undefined, now: number = Date.now()): string {
  if (!date) return '–'
  const d = new Date(date)
  return Number.isFinite(d.getTime()) ? since(d, now) : '–'
}

/** 2026-11-23 14:05 (UTC), the format used across the console. */
export function stamp(date: Date | string | null | undefined): string {
  if (!date) return '–'
  return new Date(date).toISOString().slice(0, 16).replace('T', ' ')
}

/** The last `n` UTC days as YYYY-MM-DD, oldest first. */
export function lastDays(n: number, now: Date = new Date()): string[] {
  const out: string[] = []
  for (let i = n - 1; i >= 0; i--) out.push(new Date(now.getTime() - i * 86_400_000).toISOString().slice(0, 10))
  return out
}

/** Integer from a search parameter, clamped. */
export function intParam(v: string | undefined, fallback: number, min: number, max: number): number {
  const n = Math.floor(Number(v))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}
