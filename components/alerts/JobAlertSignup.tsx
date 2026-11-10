'use client'

// "Get these jobs by email": signs the visitor up for an alert on the search they are looking at. The filters are the
// listing page's own job query (checked again on the server); the label is built on the server from them.
import * as React from 'react'
import { BellRing } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { AlertFilters } from '@/lib/alerts/filters'

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
  const id = React.useId()

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const website = (new FormData(e.currentTarget).get('website') as string) || ''
    setState({ kind: 'sending' })
    try {
      const res = await fetch('/api/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency, filters, website }),
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
            onChange={(e) => setEmail(e.target.value)}
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
