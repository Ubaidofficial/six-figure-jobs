'use client'

import { useEffect } from 'react'

type Win = Window & { dataLayer?: Array<Record<string, unknown>> }

// Next.js serves a notFound() page as a bare <html id="__next_error__"> shell and builds the real layout in the
// browser, where React's inline <script> is inert, so the GTM snippet in <head> never runs. If it did not run
// (no 'gtm.js' event in dataLayer), start GTM here, from an effect, which does execute.
export function GtmStartIfMissing({ id }: { id: string }) {
  useEffect(() => {
    const w = window as Win
    if (w.dataLayer?.some((e) => e?.event === 'gtm.js')) return
    w.dataLayer = w.dataLayer || []
    w.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' })
    const s = document.createElement('script')
    s.async = true
    s.src = `https://www.googletagmanager.com/gtm.js?id=${id}`
    document.head.appendChild(s)
  }, [id])
  return null
}
