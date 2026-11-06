'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

import styles from '../applykit/applykit.module.css'

/** Cancels an application that is still waiting (a draft or an approved one that has not been picked up). */
export function AutoApplyCancel({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState(false)

  async function cancel() {
    setBusy(true)
    setError(false)
    try {
      const res = await fetch('/api/autoapply/cancel', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (res.ok) return router.refresh()
    } catch {
      // fall through to the message
    }
    setError(true)
    setBusy(false)
  }

  return (
    <div className={styles.row}>
      <Button variant="tertiary" loading={busy} onClick={() => void cancel()}>
        Cancel this application
      </Button>
      {error ? (
        <span role="alert" className={styles.small}>
          It may already be on its way, so it could not be cancelled.
        </span>
      ) : null}
    </div>
  )
}
