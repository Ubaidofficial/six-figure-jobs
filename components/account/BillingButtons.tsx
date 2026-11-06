'use client'

import * as React from 'react'

import { Button, type ButtonVariant } from '@/components/ui/button'

import styles from './account.module.css'

const MESSAGES: Record<string, string> = {
  already_subscribed: 'You already have a subscription. Use "Manage billing" to change it.',
  no_billing_account: 'There is no billing account yet. Subscribe or buy credits first.',
  product_unavailable: 'That option is not available right now.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
}

/** Only ever send the browser to Stripe's own hosted pages. */
function isStripeUrl(value: unknown): value is string {
  try {
    const url = new URL(String(value))
    return url.protocol === 'https:' && (url.hostname === 'stripe.com' || url.hostname.endsWith('.stripe.com'))
  } catch {
    return false
  }
}

function useRedirectingPost(path: string, body?: Record<string, string>) {
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const go = React.useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(path, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body ?? {}),
      })
      const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string }
      if (res.status === 401) {
        window.location.assign('/sign-in')
        return
      }
      if (res.ok && isStripeUrl(data.url)) {
        window.location.assign(data.url)
        return // keep the button busy while the browser leaves
      }
      setError(MESSAGES[data.error ?? ''] ?? 'Something went wrong. Please try again.')
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }
    setBusy(false)
  }, [path, body])

  return { busy, error, go }
}

export function CheckoutButton({
  product,
  children,
  variant = 'primary',
}: {
  product: 'subscription' | 'pack_small' | 'pack_large'
  children: React.ReactNode
  variant?: ButtonVariant
}) {
  const body = React.useMemo(() => ({ product }), [product])
  const { busy, error, go } = useRedirectingPost('/api/billing/checkout', body)
  return (
    <div>
      <Button variant={variant} loading={busy} onClick={go} className={styles.fullWidth}>
        {children}
      </Button>
      {error ? (
        <p role="alert" className={styles.muted}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function PortalButton({ children }: { children: React.ReactNode }) {
  const { busy, error, go } = useRedirectingPost('/api/billing/portal')
  return (
    <div>
      <Button variant="secondary" loading={busy} onClick={go}>
        {children}
      </Button>
      {error ? (
        <p role="alert" className={styles.muted}>
          {error}
        </p>
      ) : null}
    </div>
  )
}
