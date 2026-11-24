// Static chart pieces for the admin console (server-rendered, no hover state): sparklines for figures, ranked bars and
// split bars. Colours and mark sizes follow charts.tsx.
import s from '../admin.module.css'

export const SERIES_COLORS = ['#2a78d6', '#eb6834'] as const
const MUTED_MARK = '#c3c2b7'

/** A small trend line for a figure: grey line, the latest day as a blue dot. Decorative; the figure carries the value. */
export function Sparkline({ values, width = 96, height = 26 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return null
  const max = Math.max(1, ...values)
  const min = Math.min(0, ...values)
  const x = (i: number) => 2 + (i / (values.length - 1)) * (width - 6)
  const y = (v: number) => 3 + (height - 6) * (1 - (v - min) / (max - min || 1))
  const last = values.length - 1
  return (
    <svg width={width} height={height} aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
      <polyline
        points={values.map((v, i) => `${x(i)},${y(v)}`).join(' ')}
        fill="none"
        stroke={MUTED_MARK}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last)} cy={y(values[last])} r={3} fill={SERIES_COLORS[0]} stroke="#fff" strokeWidth={1.5} />
    </svg>
  )
}

/** Ranked horizontal bars, one hue, largest first: a name, a bar and a figure per row. */
export function BarList({
  items,
  total,
  format = (n) => n.toLocaleString('en-US'),
}: {
  items: Array<{ label: string; value: number; href?: string; note?: string }>
  /** When given, each row also shows its share of this total. */
  total?: number
  format?: (n: number) => string
}) {
  const max = Math.max(1, ...items.map((i) => i.value))
  if (items.length === 0) return <p className={s.empty}>Nothing yet.</p>
  return (
    <ul className={s.barList}>
      {items.map((it) => (
        <li key={it.label} className={s.barRow} title={`${it.label}: ${format(it.value)}${total ? ` (${Math.round((it.value / total) * 100)}%)` : ''}`}>
          <span className={s.barName}>
            {it.href ? (
              <a className={s.link} href={it.href} target="_blank" rel="noopener">
                {it.label}
              </a>
            ) : (
              it.label
            )}
            {it.note ? <span className={s.checkDetail}>{it.note}</span> : null}
          </span>
          <span className={s.barTrack}>
            <span className={s.barFill} style={{ width: `${Math.max(1.5, (it.value / max) * 100)}%` }} />
          </span>
          <span className={s.barValue}>
            {format(it.value)}
            {total ? <span className={s.dim}> {Math.round((it.value / total) * 100)}%</span> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

/** One whole split into a few parts: a thin bar of blocks and a legend that gives each part's figure and share. */
export function SplitBar({ parts }: { parts: Array<{ label: string; value: number; color: string }> }) {
  const total = parts.reduce((n, p) => n + p.value, 0)
  if (total === 0) return <p className={s.empty}>Nothing yet.</p>
  return (
    <div>
      <div className={s.splitBar} role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {parts
          .filter((p) => p.value > 0)
          .map((p) => (
            <span key={p.label} style={{ flexGrow: p.value, background: p.color }} title={`${p.label}: ${p.value.toLocaleString('en-US')}`} />
          ))}
      </div>
      <div className={s.legend} style={{ marginTop: 10, flexWrap: 'wrap', rowGap: 6 }}>
        {parts.map((p) => (
          <span key={p.label}>
            <span className={s.legendSwatch} style={{ background: p.color }} />
            {p.label} <strong className={s.mono} style={{ color: 'var(--color-text-0)' }}>{p.value.toLocaleString('en-US')}</strong>{' '}
            <span>{Math.round((p.value / total) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Same-unit series' 7-day trailing average, for a line drawn over daily columns. */
export function movingAverage(values: number[], window = 7): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - window + 1)
    const slice = values.slice(from, i + 1)
    return slice.reduce((a, b) => a + b, 0) / slice.length
  })
}
