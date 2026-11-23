// Shared pieces of the admin console's pages. Server components (no hooks), styled by ../admin.module.css.
import Link from 'next/link'

import s from '../admin.module.css'

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

export function Figures({ items }: { items: Array<{ label: string; value: React.ReactNode; sub?: React.ReactNode }> }) {
  return (
    <div className={`${s.panel} ${s.figures}`}>
      {items.map((f) => (
        <div key={f.label} className={s.figure}>
          <div className={s.figureLabel}>{f.label}</div>
          <div className={s.figureValue}>{f.value}</div>
          {f.sub ? <div className={s.figureSub}>{f.sub}</div> : null}
        </div>
      ))}
    </div>
  )
}

export function Status({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={`${s.status} ${s[tone]}`}>{children}</span>
}

/** Filter links that look like a segmented control; `current` is the active value. */
export function Tabs({ items, current }: { items: Array<{ label: string; href: string; value: string; count?: number }>; current: string }) {
  return (
    <nav className={s.tabs} aria-label="Filter">
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

/**
 * Daily bars as inline SVG: one or two series (the second drawn behind, lighter). No chart library: a dependency for
 * two bar charts is not worth it, and the numbers are also given as text in the title of each bar.
 */
export function DailyBars({
  days,
  series,
  labels,
}: {
  days: string[]
  series: number[][]
  labels: string[]
}) {
  const max = Math.max(1, ...series.flat())
  const n = days.length
  const w = 100 / n
  return (
    <div>
      <svg className={s.chart} viewBox="0 0 100 40" preserveAspectRatio="none" role="img" aria-label={labels.join(' and ') + ' per day'}>
        {days.map((day, i) =>
          series.map((values, k) => {
            const h = (values[i] / max) * 38
            const inset = k === 0 && series.length > 1 ? w * 0.15 : w * 0.28
            return (
              <rect
                key={`${day}-${k}`}
                className={k === 0 && series.length > 1 ? s.chartBarAlt : s.chartBar}
                x={i * w + inset}
                y={40 - h}
                width={Math.max(0.4, w - inset * 2)}
                height={h}
              >
                <title>{`${day}: ${labels[k]} ${values[i].toLocaleString()}`}</title>
              </rect>
            )
          }),
        )}
      </svg>
      <div className={s.chartAxis}>
        <span>{days[0]?.slice(5)}</span>
        <span>{days[n - 1]?.slice(5)}</span>
      </div>
    </div>
  )
}

/** "4 min ago", "3 h ago", "2 days ago"; "–" for no date. */
export function ago(date: Date | string | null | undefined, now: number = Date.now()): string {
  if (!date) return '–'
  const ms = now - new Date(date).getTime()
  if (!Number.isFinite(ms)) return '–'
  const min = Math.round(ms / 60_000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 48) return `${h} h ago`
  return `${Math.round(h / 24)} days ago`
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
