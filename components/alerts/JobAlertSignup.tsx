'use client'

// "Get these jobs by email": signs the visitor up for an alert on the search they are looking at. The filters are the
// listing page's own job query (checked again on the server); the label is built on the server from them.
import * as React from 'react'
import { BellRing } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AlertFilters } from '@/lib/alerts/filters'
import { suggestEmailFix } from '@/lib/alerts/email'

import styles from './JobAlertSignup.module.css'

type Props = {
  filters: AlertFilters
  /** What the alert is for, e.g. "Senior Software Engineer jobs · Remote". */
  label: string
  variant?: 'inline' | 'footer'
  className?: string
}

type State = { kind: 'idle' | 'sending' | 'done' | 'error'; message?: string }

export function JobAlertSignup({ filters, label, variant = 'inline', className }: Props) {
  const [email, setEmail] = React.useState('')
  const [frequency, setFrequency] = React.useState<'weekly' | 'daily'>('weekly')
  const [state, setState] = React.useState<State>({ kind: 'idle' })
  // "name@gmial.com" -> offer "name@gmail.com". Checked when the field is left and on submit; never changed silently.
  const [suggestion, setSuggestion] = React.useState<string | null>(null)
  // The fix a submit has already stopped for. Only a submit counts: clicking the button blurs the field first, which
  // shows the suggestion a moment before the click, and that must not count as the visitor having seen it.
  const warnedFor = React.useRef<string | null>(null)
  const id = React.useId()

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
    setState({ kind: 'sending' })
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency, filters, website, source: window.location.pathname }),
      })
      const body = (await res.json().catch(() => ({}))) as { ok?: boolean; message?: string }
      setState(
        res.ok && body.ok
          ? { kind: 'done', message: body.message }
          : { kind: 'error', message: body.message || 'Something went wrong. Please try again.' },
      )
    } catch {
      setState({ kind: 'error', message: 'Could not reach the server. Please try again.' })
    }
  }

  return (
    <section className={cn(styles.box, variant === 'footer' && styles.footer, className)} aria-labelledby={`${id}-title`}>
      <div className={styles.text}>
        <p id={`${id}-title`} className={styles.title}>
          <BellRing aria-hidden className={styles.icon} />
          Get new jobs like these by email
        </p>
        <p className={styles.label}>{label}</p>
      </div>

      {state.kind === 'done' ? (
        <p role="status" className={styles.done}>
          {state.message}
        </p>
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
          <label htmlFor={`${id}-frequency`} className={styles.srOnly}>
            How often
          </label>
          <select
            id={`${id}-frequency`}
            value={frequency}
            onChange={(e) => setFrequency(e.target.value === 'daily' ? 'daily' : 'weekly')}
            className={styles.select}
          >
            <option value="weekly">Weekly</option>
            <option value="daily">Daily</option>
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
