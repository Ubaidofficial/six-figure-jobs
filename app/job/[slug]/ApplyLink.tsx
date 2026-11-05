'use client'

import * as React from 'react'

import type { ApplyDevice, ApplySurface } from '@/lib/analytics/applyClick'

/**
 * The Apply link. Behaves exactly like a plain external link; in addition it reports that it was clicked, using
 * sendBeacon so the visit to the employer is never delayed. Nothing is sent when the visitor has Do Not Track or
 * Global Privacy Control switched on.
 */
export function ApplyLink({
  jobId,
  surface,
  className,
  href,
  children,
}: {
  jobId: string
  surface: ApplySurface
  className?: string
  href: string
  children: React.ReactNode
}) {
  const onClick = React.useCallback(() => {
    try {
      const nav = navigator as Navigator & { globalPrivacyControl?: boolean }
      if (nav.doNotTrack === '1' || nav.globalPrivacyControl === true) return
      const device: ApplyDevice = window.matchMedia('(pointer: coarse)').matches ? 'mobile' : 'desktop'
      navigator.sendBeacon('/api/apply-click', new Blob([JSON.stringify({ jobId, surface, device })], { type: 'application/json' }))
    } catch {
      // Counting must never get in the way of applying.
    }
  }, [jobId, surface])

  return (
    <a
      href={href}
      target="_blank"
      rel="nofollow sponsored noopener noreferrer"
      className={className}
      onClick={onClick}
    >
      {children}
    </a>
  )
}
