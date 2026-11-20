'use client'

// Tells Google Tag Manager that an alert was just confirmed, once per page view, so signups and confirmations can be
// compared in GA4. No address, token or search is sent: only the frequency.
import * as React from 'react'

import { pushAlertEvent } from '@/lib/alerts/track'

export function AlertConfirmedEvent({ frequency }: { frequency: string }) {
  // Effects can run twice (React's development check); the event must not.
  const sent = React.useRef(false)
  React.useEffect(() => {
    if (sent.current) return
    sent.current = true
    pushAlertEvent('job_alert_confirm', { alert_frequency: frequency })
  }, [frequency])
  return null
}
