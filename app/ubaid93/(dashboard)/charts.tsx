'use client'
// Charts for the admin console, in plain SVG (no chart library). Rules from the data-viz method this console follows:
// one axis per chart; series colors in a fixed order (blue, then orange; checked for colour-blind separation, ΔE 24.7);
// thin marks (2px lines, columns at most 24px with a 4px rounded top); hairline grid; values in text colours, never
// the series colour; every chart has a hover readout and a table for screen readers.
import { useEffect, useRef, useState } from 'react'

import s from '../admin.module.css'

export const SERIES = ['#2a78d6', '#eb6834'] as const
const MUTED_MARK = '#c3c2b7'
const GRID = '#e1e0d9'
const INK_MUTED = '#898781'

export type Series = { label: string; values: number[]; kind?: 'line' | 'column'; color?: string; area?: boolean }

const fmt = (n: number) => (Math.abs(n) >= 10_000 ? `${Math.round(n / 1000)}K` : Math.round(n).toLocaleString('en-US'))

/** Up to 4 round tick values from 0 to a little above `max`. */
export function niceTicks(max: number): number[] {
  if (max <= 0) return [0, 1]
  const rough = max / 3
  const mag = 10 ** Math.floor(Math.log10(rough))
  // Every chart here counts things, so steps are whole numbers (a max of 1 gave 0, 0.5, 1; a max of 7 gave 2.5 steps).
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= rough && Number.isInteger(x)) ?? Math.max(1, 10 * mag)
  const ticks: number[] = []
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1000) / 1000)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

function useWidth<T extends HTMLElement>(): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)))
    ro.observe(el)
    setWidth(Math.round(el.getBoundingClientRect().width))
    return () => ro.disconnect()
  }, [])
  return [ref, width]
}

const dayLabel = (d: string, today: string) => (d === today ? 'today' : d.slice(5).replace('-', '/'))

/**
 * Daily trend: lines and/or columns over the same days and the same unit (one axis). Hovering anywhere snaps a
 * crosshair to the nearest day and lists every series' value there.
 */
export function TrendChart({ days, series, height = 180, label }: { days: string[]; series: Series[]; height?: number; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)
  const today = new Date().toISOString().slice(0, 10)
  const n = days.length
  const max = Math.max(0, ...series.flatMap((x) => x.values))
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1] || 1
  const pad = { l: 40, r: 12, t: 10, b: 24 }
  const w = Math.max(0, width - pad.l - pad.r)
  const h = height - pad.t - pad.b
  const band = n > 0 ? w / n : 0
  const x = (i: number) => pad.l + band * i + band / 2
  const y = (v: number) => pad.t + h - (v / top) * h
  const colW = Math.min(24, Math.max(2, band * 0.62) - 2)
  const multi = series.length > 1

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const i = Math.floor(((e.clientX - box.left) / box.width) * n)
    setHover(Math.min(n - 1, Math.max(0, i)))
  }

  return (
    <div>
      {multi ? (
        <div className={s.legend} style={{ marginBottom: 6 }}>
          {series.map((sr, k) => (
            <span key={sr.label}>
              <span
                className={s.legendSwatch}
                style={{ background: sr.color ?? SERIES[k], height: sr.kind === 'column' ? 9 : 3, verticalAlign: sr.kind === 'column' ? -1 : 3 }}
              />
              {sr.label}
            </span>
          ))}
        </div>
      ) : null}
      <div ref={ref} style={{ position: 'relative' }}>
        {width > 0 ? (
          <svg width={width} height={height} role="img" aria-label={label} style={{ display: 'block' }}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? MUTED_MARK : GRID} strokeWidth={1} />
                <text x={pad.l - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={INK_MUTED} style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmt(t)}
                </text>
              </g>
            ))}
            {[0, Math.floor((n - 1) / 2), n - 1]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((i) => (
                <text key={i} x={x(i)} y={height - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} fontSize={11} fill={INK_MUTED}>
                  {dayLabel(days[i], today)}
                </text>
              ))}
            {series.map((sr, k) => {
              const color = sr.color ?? SERIES[k]
              if (sr.kind === 'column') {
                return (
                  <g key={sr.label}>
                    {sr.values.map((v, i) => {
                      if (v <= 0) return null
                      const x0 = x(i) - colW / 2
                      const y0 = y(v)
                      const r = Math.min(4, colW / 2, y(0) - y0)
                      return (
                        <path
                          key={i}
                          d={`M${x0},${y(0)} V${y0 + r} Q${x0},${y0} ${x0 + r},${y0} H${x0 + colW - r} Q${x0 + colW},${y0} ${x0 + colW},${y0 + r} V${y(0)} Z`}
                          fill={color}
                          opacity={hover === null || hover === i ? 1 : 0.55}
                        />
                      )
                    })}
                  </g>
                )
              }
              const pts = sr.values.map((v, i) => `${x(i)},${y(v)}`).join(' ')
              return (
                <g key={sr.label}>
                  {sr.area ? <polygon points={`${x(0)},${y(0)} ${pts} ${x(n - 1)},${y(0)}`} fill={color} opacity={0.1} /> : null}
                  <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  <circle cx={x(n - 1)} cy={y(sr.values[n - 1] ?? 0)} r={4} fill={color} stroke="#fff" strokeWidth={2} />
                </g>
              )
            })}
            {hover !== null ? (
              <g pointerEvents="none">
                <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + h} stroke={INK_MUTED} strokeWidth={1} />
                {series
                  .filter((sr) => sr.kind !== 'column')
                  .map((sr) => (
                    <circle key={sr.label} cx={x(hover)} cy={y(sr.values[hover] ?? 0)} r={4} fill={sr.color ?? SERIES[series.indexOf(sr)]} stroke="#fff" strokeWidth={2} />
                  ))}
              </g>
            ) : null}
            <rect
              x={pad.l}
              y={0}
              width={w}
              height={height}
              fill="transparent"
              onPointerMove={onMove}
              onPointerLeave={() => setHover(null)}
            />
          </svg>
        ) : (
          <div style={{ height }} />
        )}
        {hover !== null && width > 0 ? (
          <div
            className={s.tooltip}
            style={{ left: Math.min(Math.max(x(hover) + 10, 0), width - 170), top: 4 }}
            role="status"
          >
            <div className={s.tooltipHead}>{days[hover]}</div>
            {series.map((sr, k) => (
              <div key={sr.label} className={s.tooltipRow}>
                <span className={s.legendSwatch} style={{ background: sr.color ?? SERIES[k] }} />
                <strong>{(sr.values[hover] ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}</strong>
                <span>{sr.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <table className={s.srOnly}>
        <caption>{label}</caption>
        <thead>
          <tr>
            <th>Day</th>
            {series.map((sr) => (
              <th key={sr.label}>{sr.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {days.map((d, i) => (
            <tr key={d}>
              <td>{d}</td>
              {series.map((sr) => (
                <td key={sr.label}>{(sr.values[i] ?? 0).toLocaleString('en-US', { maximumFractionDigits: 1 })}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
