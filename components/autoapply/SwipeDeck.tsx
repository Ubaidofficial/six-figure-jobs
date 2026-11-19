'use client'

// Swipe through jobs one card at a time. Right (→, the ✓ button or a drag right) makes an auto-apply draft for that job:
// we read the employer's form and fill what is yours, for free. Nothing is sent until you review and approve each draft
// in your queue. Left (←, ✕ or a drag left) skips the job; skips are remembered in this browser and can be undone.
import * as React from 'react'
import Link from 'next/link'
import { Check, ExternalLink, Loader2, MapPin, RotateCcw, Search, Sparkles, X } from 'lucide-react'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import type { SwipeCard } from '@/lib/autoapply/deck'
import { cn } from '@/lib/utils'

import s from './swipe.module.css'

export type QueueItem = { id: string | null; key: string; title: string; company: string; status: string }

const SKIP_KEY = 'sfj-swipe-skipped'
const THRESHOLD = 110
const ERRORS: Record<string, string> = {
  no_resume: 'Add your résumé first: it is what we attach.',
  unsupported_employer: 'Auto-apply is not available for this employer.',
  form_unavailable: 'We could not read this employer’s form right now. It is back in your deck.',
  already_exists: 'You already have an application for this job.',
  job_not_found: 'This job is no longer listed.',
  rate_limited: 'That is 10 drafts in 10 minutes. Review a few in your queue, then keep swiping.',
}

function readSkipped(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(SKIP_KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string').slice(-500) : []
  } catch {
    return []
  }
}
function writeSkipped(ids: string[]) {
  try {
    window.localStorage.setItem(SKIP_KEY, JSON.stringify(ids.slice(-500)))
  } catch {
    // Private mode or storage off: skips last for this visit only.
  }
}
function track(direction: 'right' | 'left' | 'undo') {
  try {
    const w = window as Window & { dataLayer?: Array<Record<string, unknown>> }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event: 'job_swipe', swipe_direction: direction })
  } catch {
    // Tracking never breaks the deck.
  }
}

const ago = (iso: string) => {
  const h = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 3_600_000))
  return h < 1 ? 'Listed just now' : h < 24 ? `Listed ${h}h ago` : `Listed ${Math.round(h / 24)}d ago`
}

async function post(path: string, body: unknown) {
  const res = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const data = (await res.json().catch(() => ({}))) as Record<string, any>
  if (res.status === 401) window.location.assign('/sign-in?callbackUrl=%2Faccount%2Fswipe')
  return { ok: res.ok, data }
}

export function SwipeDeck({
  initialCards,
  initialQueue,
  cost,
  balance,
}: {
  initialCards: SwipeCard[]
  initialQueue: QueueItem[]
  cost: number
  /** The user's credits now; shown so they know how many approvals they can afford. */
  balance: number
}) {
  const [cards, setCards] = React.useState(initialCards)
  const [queue, setQueue] = React.useState(initialQueue)
  const [skipped, setSkipped] = React.useState<string[]>([])
  const [lastSkip, setLastSkip] = React.useState<SwipeCard | null>(null)
  const [drag, setDrag] = React.useState({ x: 0, y: 0, active: false })
  const [leaving, setLeaving] = React.useState<'left' | 'right' | null>(null)
  const [toast, setToast] = React.useState<{ text: string; href?: string } | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [done, setDone] = React.useState(initialCards.length === 0)
  // False once the server has nothing new for these filters, so the deck stops asking.
  const [more, setMore] = React.useState(initialCards.length > 0)
  const [keyword, setKeyword] = React.useState('')
  const [remote, setRemote] = React.useState(false)
  const filters = React.useRef({ keyword: '', remote: false })
  const start = React.useRef<{ x: number; y: number; t: number } | null>(null)

  // Skips from earlier visits: hide them from the first cards too.
  React.useEffect(() => {
    const prev = readSkipped()
    setSkipped(prev)
    if (prev.length) setCards((c) => c.filter((x) => !prev.includes(x.id)))
  }, [])

  const load = React.useCallback(
    async (replace: boolean, skip: string[]) => {
      setLoading(true)
      const { ok, data } = await post('/api/autoapply/deck', { ...filters.current, skip }).catch(() => ({ ok: false, data: {} as Record<string, any> }))
      setLoading(false)
      // A failed request must not be retried in a loop: stop until the user changes filters.
      if (!ok) return setMore(false)
      const next = (data.cards ?? []) as SwipeCard[]
      setCards((c) => {
        const have = new Set(replace ? [] : c.map((x) => x.id))
        const fresh = next.filter((x) => !have.has(x.id))
        const merged = [...(replace ? [] : c), ...fresh]
        setMore(fresh.length > 0)
        setDone(merged.length === 0)
        return merged
      })
    },
    [],
  )

  // Keep a few cards in hand.
  React.useEffect(() => {
    if (more && !loading && cards.length < 5) void load(false, [...skipped, ...cards.map((c) => c.id)])
    else if (!more && cards.length === 0) setDone(true)
  }, [cards.length, more, loading, load, skipped])

  const top = cards[0]

  const decide = React.useCallback(
    (dir: 'left' | 'right') => {
      if (!top || leaving) return
      setLeaving(dir)
      track(dir)
      window.setTimeout(() => {
        setCards((c) => c.slice(1))
        setLeaving(null)
        setDrag({ x: 0, y: 0, active: false })
      }, 220)
      if (dir === 'left') {
        const next = [...skipped, top.id]
        setSkipped(next)
        writeSkipped(next)
        setLastSkip(top)
        return
      }
      setLastSkip(null)
      const key = `p-${top.id}`
      setQueue((q) => [{ id: null, key, title: top.title, company: top.company, status: 'preparing' }, ...q])
      void post('/api/autoapply/prepare', { job: top.slug })
        .then(({ ok, data }) => {
          if (ok && data.id) {
            setQueue((q) => q.map((i) => (i.key === key ? { ...i, id: data.id, key: data.id, status: 'draft' } : i)))
            setToast({ text: `Draft ready: ${top.title}. Review it before it goes.`, href: `/account/autoapply/${data.id}` })
            return
          }
          setQueue((q) => q.filter((i) => i.key !== key))
          const code = String(data.error ?? '')
          const existing = code === 'already_exists' && data.details?.id ? `/account/autoapply/${data.details.id}` : undefined
          setToast({ text: ERRORS[code] ?? 'Could not prepare that one. It is back in your deck.', href: existing })
          // Worth another try later: put it back on top.
          if (code === 'rate_limited' || code === 'form_unavailable' || !ERRORS[code]) setCards((c) => [top, ...c.filter((x) => x.id !== top.id)])
        })
        .catch(() => {
          setQueue((q) => q.filter((i) => i.key !== key))
          setToast({ text: 'Could not reach the server. That job is back in your deck.' })
          setCards((c) => [top, ...c.filter((x) => x.id !== top.id)])
        })
    },
    [top, leaving, skipped],
  )

  const undo = () => {
    if (!lastSkip) return
    const next = skipped.filter((id) => id !== lastSkip.id)
    setSkipped(next)
    writeSkipped(next)
    setCards((c) => [lastSkip, ...c])
    setDone(false)
    setLastSkip(null)
    track('undo')
  }

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (e.key === 'ArrowRight') decide('right')
      else if (e.key === 'ArrowLeft') decide('left')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [decide])

  React.useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 6000)
    return () => window.clearTimeout(t)
  }, [toast])

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('a,button')) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    start.current = { x: e.clientX, y: e.clientY, t: performance.now() }
    setDrag({ x: 0, y: 0, active: true })
  }
  const onMove = (e: React.PointerEvent) => {
    if (!start.current) return
    setDrag({ x: e.clientX - start.current.x, y: (e.clientY - start.current.y) * 0.3, active: true })
  }
  const onUp = (e: React.PointerEvent) => {
    if (!start.current) return
    const dx = e.clientX - start.current.x
    const speed = Math.abs(dx) / Math.max(1, performance.now() - start.current.t)
    start.current = null
    if (Math.abs(dx) > THRESHOLD || (Math.abs(dx) > 40 && speed > 0.6)) decide(dx > 0 ? 'right' : 'left')
    else setDrag({ x: 0, y: 0, active: false })
  }

  const applyFilters = (e: React.FormEvent) => {
    e.preventDefault()
    filters.current = { keyword: keyword.trim(), remote }
    setDone(false)
    setMore(true)
    setCards([])
    void load(true, skipped)
  }

  const x = leaving ? (leaving === 'right' ? 900 : -900) : drag.x
  const intent = leaving ?? (drag.x > 40 ? 'right' : drag.x < -40 ? 'left' : null)
  const strength = leaving ? 1 : Math.min(1, Math.abs(drag.x) / THRESHOLD)
  const waiting = queue.filter((q) => q.status === 'draft' || q.status === 'preparing').length
  // The oldest draft that is ready, so "Review next" works through the queue in the order it was swiped.
  const nextDraft = [...queue].reverse().find((q) => q.status === 'draft' && q.id)

  return (
    <div className={s.wrap}>
      <div className={s.deckCol}>
        <form className={s.filters} onSubmit={applyFilters} role="search">
          <label className={s.search}>
            <Search aria-hidden />
            <span className={s.srOnly}>Role or skill</span>
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="Any role, or e.g. Product manager" maxLength={60} />
          </label>
          <label className={s.toggle}>
            <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
            Remote only
          </label>
          <button type="submit" className={s.filterBtn}>
            Show jobs
          </button>
        </form>

        <div className={s.stage} aria-live="polite">
          {top ? (
            cards.slice(0, 3).map((c, i) => {
              const isTop = i === 0
              const style: React.CSSProperties = isTop
                ? { transform: `translate(${x}px, ${leaving ? drag.y : drag.y}px) rotate(${x / 18}deg)`, transition: drag.active && !leaving ? 'none' : undefined, zIndex: 3 }
                : { transform: `translateY(${i * 12}px) scale(${1 - i * 0.04})`, zIndex: 3 - i }
              return (
                <article
                  key={c.id}
                  className={cn(s.card, isTop && s.cardTop, leaving && isTop && s.leaving)}
                  style={style}
                  aria-hidden={!isTop}
                  aria-label={isTop ? `${c.title} at ${c.company}` : undefined}
                  onPointerDown={isTop ? onDown : undefined}
                  onPointerMove={isTop ? onMove : undefined}
                  onPointerUp={isTop ? onUp : undefined}
                  onPointerCancel={isTop ? onUp : undefined}
                >
                  {isTop ? (
                    <>
                      <span className={cn(s.stamp, s.stampApply)} style={{ opacity: intent === 'right' ? strength : 0 }}>
                        Apply
                      </span>
                      <span className={cn(s.stamp, s.stampSkip)} style={{ opacity: intent === 'left' ? strength : 0 }}>
                        Skip
                      </span>
                    </>
                  ) : null}
                  <div className={s.cardTopRow}>
                    <CompanyLogo name={c.company} src={c.logo} size="xl" />
                    <span className={s.listed}>{ago(c.listedAt)}</span>
                  </div>
                  <p className={s.company}>{c.company}</p>
                  <h2 className={s.jobTitle}>{c.title}</h2>
                  {c.salary ? <p className={s.salary}>{c.salary}</p> : null}
                  <div className={s.chips}>
                    {c.location ? (
                      <span className={s.chip}>
                        <MapPin aria-hidden /> {c.location}
                      </span>
                    ) : null}
                    {c.remote ? <span className={cn(s.chip, s.chipRemote)}>Remote</span> : null}
                    <span className={cn(s.chip, s.chipAuto)}>
                      <Sparkles aria-hidden /> Auto-apply ready
                    </span>
                  </div>
                  <Link href={`/job/${c.slug}`} target="_blank" className={s.viewJob}>
                    Read the full job <ExternalLink aria-hidden />
                  </Link>
                </article>
              )
            })
          ) : (
            <div className={s.empty}>
              {loading && !done ? (
                <>
                  <Loader2 className={s.spin} aria-hidden />
                  <p>Finding jobs you can auto-apply to…</p>
                </>
              ) : (
                <>
                  <p className={s.emptyTitle}>You have seen every matching job</p>
                  <p>New $100k+ jobs arrive every day. Try another role, or switch off Remote only.</p>
                </>
              )}
            </div>
          )}
        </div>

        <div className={s.controls}>
          <button type="button" className={cn(s.round, s.roundSkip)} onClick={() => decide('left')} disabled={!top || !!leaving} aria-label="Skip this job (left arrow)">
            <X aria-hidden />
          </button>
          <button type="button" className={cn(s.round, s.roundUndo)} onClick={undo} disabled={!lastSkip} aria-label="Undo last skip">
            <RotateCcw aria-hidden />
          </button>
          <button type="button" className={cn(s.round, s.roundApply)} onClick={() => decide('right')} disabled={!top || !!leaving} aria-label="Queue an application for this job (right arrow)">
            <Check aria-hidden />
          </button>
        </div>
        <p className={s.keys}>
          Drag the card, or use <kbd>←</kbd> skip and <kbd>→</kbd> apply.
        </p>

        {toast ? (
          <div role="status" className={s.toast}>
            <span>{toast.text}</span>
            {toast.href ? (
              <Link href={toast.href} className={s.toastLink}>
                Review
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <aside className={s.queue} aria-labelledby="queue-h">
        <h2 id="queue-h" className={s.queueTitle}>
          Your apply queue {waiting ? <span className={s.badge}>{waiting}</span> : null}
        </h2>
        <p className={s.queueHint}>
          A right swipe prepares a draft for free. Nothing is sent until you review and approve it. Each one costs {cost}{' '}
          {cost === 1 ? 'credit' : 'credits'}, only if the employer confirms it.
        </p>
        <div className={s.meter}>
          <span>
            <strong>{balance}</strong> {balance === 1 ? 'credit' : 'credits'}
          </span>
          <span className={s.meterHint}>
            {balance < cost ? (
              <>
                You need {cost} to approve one. <Link href="/pricing">Add credits</Link>
              </>
            ) : (
              `enough for ${Math.floor(balance / cost)} confirmed ${Math.floor(balance / cost) === 1 ? 'application' : 'applications'}`
            )}
          </span>
        </div>
        {nextDraft ? (
          <Link href={`/account/autoapply/${nextDraft.id}`} className={s.reviewNext}>
            Review next: {nextDraft.title}
          </Link>
        ) : null}
        {queue.length === 0 ? (
          <p className={s.queueEmpty}>Swipe right on a job to start.</p>
        ) : (
          <ul className={s.queueList}>
            {queue.slice(0, 30).map((q) => (
              <li key={q.key} className={s.queueItem}>
                <div className={s.queueText}>
                  <span className={s.queueJob}>{q.title}</span>
                  <span className={s.queueCo}>{q.company}</span>
                </div>
                {q.status === 'preparing' ? (
                  <span className={s.queueState}>
                    <Loader2 className={s.spin} aria-hidden /> Preparing
                  </span>
                ) : q.id ? (
                  <Link href={`/account/autoapply/${q.id}`} className={cn(s.queueState, q.status === 'draft' && s.queueReview)}>
                    {q.status === 'draft' ? 'Review' : q.status === 'approved' ? 'Queued' : q.status === 'submitted' ? 'Sent' : 'Open'}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </aside>
    </div>
  )
}
