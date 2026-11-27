'use client'

// The job page's alert card (lib/alerts/jobAlertCard.ts): it slides in after a few seconds or half-way down the page (on
// phones only half-way down) and has a close button that keeps it away for 14 days (owner's request, 2026-11-27; it had
// none from 2026-11-25). It floats in a corner and never covers
// the job text's column centre or the Apply button: on phones it sits above the sticky Apply bar and leaves the Feedback
// button free. It is added after load, so it is in no server HTML and changes no crawled markup, canonical or JSON-LD.
// Not a dialog: it does not take focus or trap the keyboard, and it is announced as a page region.
import * as React from 'react'
import { BellRing, MailCheck, X } from 'lucide-react'

import type { AlertFilters } from '@/lib/alerts/filters'
import { suggestEmailFix } from '@/lib/alerts/email'
import {
  ALERT_SIGNED_UP_KEY,
  JOB_CARD_DISMISS_KEY,
  JOB_CARD_DISMISS_SNOOZE_MS,
  SIGNED_UP_FOR_MS,
  boxesOverlap,
  jobCardDue,
  jobCardHeadline,
  jobCardHidden,
  pickCardSide,
  type CardSide,
} from '@/lib/alerts/jobAlertCard'
import { POPUP_SIGNUP_SNOOZE_MS, POPUP_STORAGE_KEY } from '@/lib/alerts/popup'
import { pushAlertEvent } from '@/lib/alerts/track'

import styles from './JobAlertCard.module.css'

// Storage can throw (private windows, blocked site data): the card then behaves as if nothing was stored.
function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    /* nothing to do */
  }
}

type State = { kind: 'idle' | 'sending' | 'done' | 'error'; message?: string }

export function JobAlertCard({ filters, label, newThisWeek }: { filters: AlertFilters; label: string; newThisWeek: number | null }) {
  const [open, setOpen] = React.useState(false)
  const [email, setEmail] = React.useState('')
  const [state, setState] = React.useState<State>({ kind: 'idle' })
  const [suggestion, setSuggestion] = React.useState<string | null>(null)
  // Desktop: bottom-right, unless an Apply link would be under it there (the "Ready to apply?" box); then bottom-left; hidden
  // while one would be under it on both sides. Phones have one place: hidden while an Apply link is under it.
  const [side, setSide] = React.useState<CardSide>('right')
  const cardRef = React.useRef<HTMLElement>(null)
  const id = React.useId()

  React.useEffect(() => {
    const now = Date.now()
    if (jobCardHidden(read(ALERT_SIGNED_UP_KEY), now) || jobCardHidden(read(JOB_CARD_DISMISS_KEY), now)) return
    const started = now
    const phone = window.matchMedia('(max-width: 1023px)').matches
    const check = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (jobCardDue(Date.now() - started, scrollable > 0 ? window.scrollY / scrollable : 0, phone)) {
        cleanup()
        setOpen(true)
        pushAlertEvent('job_alert_card_shown', {})
      }
    }
    const timer = window.setInterval(check, 1000)
    const cleanup = () => {
      window.clearInterval(timer)
      window.removeEventListener('scroll', check)
    }
    window.addEventListener('scroll', check, { passive: true })
    return cleanup
  }, [])

  React.useEffect(() => {
    if (!open) return
    let frame = 0
    const place = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const card = cardRef.current
        if (!card) return
        // Never hide it while the reader is typing in it.
        if (card.contains(document.activeElement)) return
        const r = card.getBoundingClientRect()
        const links = [...document.querySelectorAll('[data-apply-link]')]
          .map((a) => a.getBoundingClientRect())
          .filter((q) => q.height > 0)
        const coveredAt = (left: number) =>
          links.some((q) => boxesOverlap(q, { left, right: left + r.width, top: r.top, bottom: r.bottom }))
        if (window.innerWidth < 1024) return setSide(pickCardSide(coveredAt(r.left), null))
        setSide(pickCardSide(coveredAt(window.innerWidth - 24 - r.width), coveredAt(24)))
      })
    }
    place()
    // Again once the slide-in has finished: while it runs the card sits lower than where it lands.
    const settled = window.setTimeout(place, 700)
    window.addEventListener('scroll', place, { passive: true })
    window.addEventListener('resize', place)
    return () => {
      cancelAnimationFrame(frame)
      window.clearTimeout(settled)
      window.removeEventListener('scroll', place)
      window.removeEventListener('resize', place)
    }
  }, [open])

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!email.trim()) {
      setState({ kind: 'error', message: 'Enter your email to get these jobs.' })
      return
    }
    const website = (new FormData(e.currentTarget).get('website') as string) || ''
    const fix = suggestEmailFix(email)
    if (fix && !suggestion) {
      setSuggestion(fix)
      return
    }
    setState({ kind: 'sending' })
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency: 'weekly', filters, website, source: window.location.pathname }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (res.ok && body.ok) {
        setState({ kind: 'done' })
        // Signed up: this card and the site-wide corner popup stay away.
        write(ALERT_SIGNED_UP_KEY, String(Date.now() + SIGNED_UP_FOR_MS))
        write(POPUP_STORAGE_KEY, String(Date.now() + POPUP_SIGNUP_SNOOZE_MS))
        pushAlertEvent('job_alert_signup', { alert_form: 'job-card', alert_frequency: 'weekly', alert_has_role: Boolean(filters.roleSlugs?.length) })
        // Done is a good place to leave: the card slides away a few seconds after the confirmation.
        window.setTimeout(() => setOpen(false), 9000)
      } else {
        setState({ kind: 'error', message: body.message || 'Something went wrong. Please try again.' })
      }
    } catch {
      setState({ kind: 'error', message: 'Could not reach the server. Please try again.' })
    }
  }

  if (!open) return null
  const what = label.split(' · ')[0] || 'six-figure jobs'
  return (
    <aside
      ref={cardRef}
      className={`${styles.card} ${side === 'left' ? styles.left : ''} ${side === 'hidden' ? styles.away : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <div className={styles.inner}>
        <button
          type="button"
          className={styles.close}
          aria-label="Close"
          onClick={() => {
            write(JOB_CARD_DISMISS_KEY, String(Date.now() + JOB_CARD_DISMISS_SNOOZE_MS))
            setOpen(false)
          }}
        >
          <X aria-hidden width={16} height={16} />
        </button>
        {state.kind === 'done' ? (
          <div role="status" className={styles.done}>
            <MailCheck aria-hidden className={styles.doneIcon} />
            <div>
              <p className={styles.title}>Check your inbox</p>
              <p className={styles.sub}>
                Confirm the email we sent to <strong>{email.trim()}</strong> to switch the alert on.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className={styles.head}>
              <span className={styles.bell} aria-hidden>
                <BellRing width={18} height={18} />
              </span>
              <div className={styles.text}>
                <p id={`${id}-title`} className={styles.title}>
                  {jobCardHeadline(newThisWeek, what)}
                </p>
                <p className={styles.sub}>{label} · free weekly email, unsubscribe in one click</p>
              </div>
            </div>
            <form className={styles.form} onSubmit={submit} noValidate>
              <label htmlFor={`${id}-email`} className={styles.srOnly}>
                Email address
              </label>
              <input
                id={`${id}-email`}
                className={styles.input}
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                placeholder="you@email.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setSuggestion(null)
                  if (state.kind === 'error') setState({ kind: 'idle' })
                }}
              />
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className={styles.trap} />
              <button className={styles.button} type="submit" disabled={state.kind === 'sending'}>
                {state.kind === 'sending' ? 'Sending…' : 'Notify me'}
              </button>
            </form>
            {suggestion ? (
              <p className={styles.note}>
                Did you mean{' '}
                <button
                  type="button"
                  className={styles.link}
                  onClick={() => {
                    setEmail(suggestion)
                    setSuggestion(null)
                  }}
                >
                  {suggestion}
                </button>
                ? Press Notify me again to keep what you typed.
              </p>
            ) : null}
            {state.kind === 'error' ? (
              <p role="alert" className={styles.error}>
                {state.message}
              </p>
            ) : null}
          </>
        )}
      </div>
    </aside>
  )
}
