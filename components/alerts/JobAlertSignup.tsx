'use client'

// "Get these jobs by email": signs the visitor up for an alert on the search they are looking at. The filters are the
// listing page's own job query (checked again on the server); the label is built on the server from them.
import * as React from 'react'
import { usePathname } from 'next/navigation'
import { BellRing, MailCheck } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AlertFilters } from '@/lib/alerts/filters'
import { suggestEmailFix } from '@/lib/alerts/email'
import { cleanAlertKeyword } from '@/lib/alerts/keyword'
import { pushAlertEvent } from '@/lib/alerts/track'

import styles from './JobAlertSignup.module.css'

type Props = {
  filters: AlertFilters
  /** What the alert is for, e.g. "Senior Software Engineer jobs · Remote". */
  label: string
  variant?: 'inline' | 'footer' | 'popup'
  className?: string
  /** Called once, when the signup was accepted (the popup remembers it and stops showing). */
  onSuccess?: () => void
}

type State = { kind: 'idle' | 'sending' | 'done' | 'error'; message?: string }

// Offered while typing in the role field; any other role or skill works too.
const ROLE_IDEAS = [
  'Software Engineer',
  'Senior Software Engineer',
  'Engineering Manager',
  'Product Manager',
  'Data Scientist',
  'Machine Learning Engineer',
  'Data Engineer',
  'DevOps Engineer',
  'Product Designer',
  'Account Executive',
  'Solutions Engineer',
  'Marketing Manager',
]

const titleCase = (s: string) => s.replace(/(^|[\s-])\p{L}/gu, (m) => m.toUpperCase())

export function JobAlertSignup({ filters, label, variant = 'inline', className, onSuccess }: Props) {
  const [email, setEmail] = React.useState('')
  const [frequency, setFrequency] = React.useState<'weekly' | 'daily' | 'instant'>('weekly')
  const [state, setState] = React.useState<State>({ kind: 'idle' })
  // The footer and the popup sign up for "all jobs"; there the visitor can narrow it to a role and to remote work.
  // A listing page's box already carries that page's search, so it does not ask.
  const canNarrow = variant !== 'inline' && Object.keys(filters).length === 0
  const [role, setRole] = React.useState('')
  const [remote, setRemote] = React.useState(false)
  // "name@gmial.com" -> offer "name@gmail.com". Checked when the field is left and on submit; never changed silently.
  const [suggestion, setSuggestion] = React.useState<string | null>(null)
  // The fix a submit has already stopped for. Only a submit counts: clicking the button blurs the field first, which
  // shows the suggestion a moment before the click, and that must not count as the visitor having seen it.
  const warnedFor = React.useRef<string | null>(null)
  const id = React.useId()
  const pathname = usePathname()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const website = (new FormData(e.currentTarget).get('website') as string) || ''
    // A likely typo stops the first submit so the visitor sees the suggestion; a second submit sends as typed.
    const fix = suggestEmailFix(email)
    if (fix && warnedFor.current !== fix) {
      warnedFor.current = fix
      setSuggestion(fix)
      return
    }
    const keyword = role.trim() ? cleanAlertKeyword(role) : null
    if (role.trim() && !keyword) {
      setState({ kind: 'error', message: 'Use only letters and numbers for the role, for example "Product manager".' })
      return
    }
    const chosen: AlertFilters = canNarrow
      ? { ...filters, ...(keyword ? { keyword } : {}), ...(remote ? { remoteMode: 'remote' as const } : {}) }
      : filters
    setState({ kind: 'sending' })
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency, filters: chosen, website, source: window.location.pathname }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      if (res.ok && body.ok) {
        setState({ kind: 'done', message: body.message })
        pushAlertEvent('job_alert_signup', {
          alert_form: variant,
          alert_frequency: frequency,
          alert_has_role: Boolean(keyword) || Boolean(filters.roleSlugs?.length),
          alert_remote: remote || Boolean(filters.remoteMode || filters.remoteOnly),
        })
        onSuccess?.()
      } else {
        setState({ kind: 'error', message: body.message || 'Something went wrong. Please try again.' })
      }
    } catch {
      setState({ kind: 'error', message: 'Could not reach the server. Please try again.' })
    }
  }

  // The footer's box would sit under an alert's own page, offering the same signup the visitor just made.
  if (variant === 'footer' && pathname?.startsWith('/alerts/')) return null

  return (
    <section className={cn(styles.box, variant === 'footer' && styles.footer, variant === 'popup' && styles.popup, className)} aria-labelledby={`${id}-title`}>
      <div className={styles.text}>
        <p id={`${id}-title`} className={styles.title}>
          <BellRing aria-hidden className={styles.icon} />
          Get new jobs like these by email
        </p>
        <p className={styles.label}>
          {canNarrow && (role.trim() || remote)
            ? [`${role.trim() ? titleCase(role.trim().replace(/\s+/g, ' ')) : 'Six-figure'} jobs`, remote ? 'Remote' : null]
                .filter(Boolean)
                .join(' · ')
            : label}
        </p>
      </div>

      {state.kind === 'done' ? (
        <div role="status" className={styles.done}>
          <p className={styles.doneTitle}>
            <MailCheck aria-hidden className={styles.icon} />
            Almost done: confirm in your inbox
          </p>
          <p>
            We sent a link to <strong>{email.trim()}</strong>. Open it to switch your alert on. Not there in a minute? Check spam
            or promotions. If you already get this alert, nothing changes.
          </p>
        </div>
      ) : (
        <form className={styles.form} onSubmit={onSubmit} noValidate>
          <label htmlFor={`${id}-email`} className={styles.srOnly}>
            Email address
          </label>
          <input
            id={`${id}-email`}
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setSuggestion(null)
            }}
            onBlur={() => setSuggestion(suggestEmailFix(email))}
            aria-describedby={suggestion ? `${id}-suggestion` : undefined}
            className={styles.input}
          />
          {canNarrow ? (
            <>
              <label htmlFor={`${id}-role`} className={styles.srOnly}>
                Role or skill (optional)
              </label>
              <input
                id={`${id}-role`}
                type="text"
                name="role"
                list={`${id}-roles`}
                maxLength={60}
                autoComplete="off"
                placeholder="Any role, or e.g. Product manager"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className={cn(styles.input, styles.role)}
              />
              <datalist id={`${id}-roles`}>
                {ROLE_IDEAS.map((r) => (
                  <option key={r} value={r} />
                ))}
              </datalist>
              <label className={styles.toggle}>
                <input type="checkbox" checked={remote} onChange={(e) => setRemote(e.target.checked)} />
                Remote only
              </label>
            </>
          ) : null}
          <label htmlFor={`${id}-frequency`} className={styles.srOnly}>
            How often
          </label>
          <select
            id={`${id}-frequency`}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value === 'daily' ? 'daily' : e.target.value === 'instant' ? 'instant' : 'weekly')}
            className={styles.select}
          >
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
            {/* Shown only when subscriptions are on; the server refuses it unless the visitor is a signed-in subscriber. */}
            {process.env.NEXT_PUBLIC_ACCOUNTS_ENABLED === 'true' ? <option value="instant">Instant (Pro)</option> : null}
          </select>
          {/* Hidden from people; bots that fill every field reveal themselves. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className={styles.trap} />
          <button type="submit" className={styles.button} disabled={state.kind === 'sending'}>
            {state.kind === 'sending' ? 'Sending…' : 'Get alerts'}
          </button>
        </form>
      )}

      {suggestion && state.kind !== 'done' ? (
        <p id={`${id}-suggestion`} className={styles.suggestion} role="status">
          Did you mean{' '}
          <button
            type="button"
            className={styles.suggestionButton}
            onClick={() => {
              setEmail(suggestion)
              setSuggestion(null)
            }}
          >
            {suggestion}
          </button>
          ?
        </p>
      ) : null}

      {state.kind === 'error' ? (
        <p role="alert" className={styles.error}>
          {state.message}
        </p>
      ) : state.kind !== 'done' ? (
        <p className={styles.fine}>Only new matching jobs, nothing else. Confirm by email; unsubscribe in one click.</p>
      ) : null}
    </section>
  )
}
