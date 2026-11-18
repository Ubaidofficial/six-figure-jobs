// lib/alerts/track.ts
// Job-alert events for Google Tag Manager (dataLayer). GA4 sees them once a GTM tag forwards these event names.
// Never pass an address, a token or the search itself: GA4 must not receive personal data.

export type AlertEvent = 'job_alert_signup' | 'job_alert_confirm'
type Params = Record<string, string | boolean>

export function pushAlertEvent(event: AlertEvent, params: Params = {}): void {
  try {
    const w = window as Window & { dataLayer?: Array<Record<string, unknown>> }
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ event, ...params })
  } catch {
    // Tracking must never break the form or the page.
  }
}
