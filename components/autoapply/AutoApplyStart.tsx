'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'

import styles from '../applykit/applykit.module.css'

const MESSAGES: Record<string, string> = {
  no_resume: 'Add your résumé first.',
  job_not_found: 'This job is no longer listed.',
  unsupported_employer: 'Auto-apply is not available for this employer.',
  form_unavailable: 'We could not read this employer\'s form right now. Try again later or apply on their site.',
  already_exists: 'You already have an application for this job.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
}

/** Opens (or creates) the draft for this job: reads the employer's form, fills what is yours, costs nothing. */
export function AutoApplyStart({ slug }: { slug: string }) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  async function start() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/autoapply/prepare', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job: slug }),
      })
      const data = (await res.json().catch(() => ({}))) as { id?: string; error?: string; details?: { id?: string } }
      if (res.status === 401) return window.location.assign(`/sign-in?callbackUrl=${encodeURIComponent(`/account/kit/${slug}`)}`)
      if (res.ok && data.id) return window.location.assign(`/account/autoapply/${encodeURIComponent(data.id)}`)
      if (data.error === 'already_exists' && data.details?.id) return window.location.assign(`/account/autoapply/${encodeURIComponent(data.details.id)}`)
      setError(MESSAGES[data.error ?? ''] ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }
    setBusy(false)
  }

  return (
    <div>
      <p className={styles.hint}>
        We fill the employer&apos;s form from your details, you review every answer, and nothing is sent until you approve.
        Free to prepare; credits are used only if the employer confirms your application.
      </p>
      <div className={styles.row}>
        <Button variant="secondary" loading={busy} onClick={() => void start()}>
          Prepare auto-apply
        </Button>
      </div>
      {error ? (
        <p role="alert" className={styles.hint}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
