'use client'

// The exit-intent alert modal (rules in lib/alerts/popup.ts): desktop only, when the mouse leaves through the top edge of
// the window, once per visit. It closes with its button, Escape or a click outside, and closing it keeps every alert popup
// away for 14 days, as the corner popup's close does. Added after load, so it is in no server HTML and changes no crawled
// markup, canonical, hreflang or JSON-LD.
import * as React from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

import { ALERT_SIGNED_UP_KEY, jobCardHidden } from '@/lib/alerts/jobAlertCard'
import {
  EXIT_ARM_DELAY_MS,
  EXIT_MEDIA_QUERY,
  EXIT_SESSION_KEY,
  POPUP_DISMISS_SNOOZE_MS,
  POPUP_SIGNUP_SNOOZE_MS,
  POPUP_STORAGE_KEY,
  isExitIntent,
  popupAllowedOnPath,
  popupIsSnoozed,
} from '@/lib/alerts/popup'

import { JobAlertSignup } from './JobAlertSignup'
import styles from './JobAlertExitIntent.module.css'

// Storage can throw (private windows, blocked site data); the modal then behaves as if nothing was stored.
function read(store: 'local' | 'session', key: string): string | null {
  try {
    return (store === 'local' ? window.localStorage : window.sessionStorage).getItem(key)
  } catch {
    return null
  }
}
function write(store: 'local' | 'session', key: string, value: string) {
  try {
    ;(store === 'local' ? window.localStorage : window.sessionStorage).setItem(key, value)
  } catch {
    /* nothing to do */
  }
}

export function JobAlertExitIntentClient({ label }: { label: string }) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)
  const dialogRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    setOpen(false)
    if (!popupAllowedOnPath(pathname) || !window.matchMedia(EXIT_MEDIA_QUERY).matches) return
    const now = Date.now()
    if (popupIsSnoozed(read('local', POPUP_STORAGE_KEY), now) || jobCardHidden(read('local', ALERT_SIGNED_UP_KEY), now)) return
    if (read('session', EXIT_SESSION_KEY)) return

    const onOut = (e: MouseEvent) => {
      if (!isExitIntent(e)) return
      cleanup()
      write('session', EXIT_SESSION_KEY, '1')
      setOpen(true)
    }
    const arm = window.setTimeout(() => document.addEventListener('mouseout', onOut), EXIT_ARM_DELAY_MS)
    const cleanup = () => {
      window.clearTimeout(arm)
      document.removeEventListener('mouseout', onOut)
    }
    return cleanup
  }, [pathname])

  const hide = React.useCallback(() => {
    write('local', POPUP_STORAGE_KEY, String(Date.now() + POPUP_DISMISS_SNOOZE_MS))
    setOpen(false)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const before = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLInputElement>('input[type="email"]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      before?.focus?.()
    }
  }, [open, hide])

  if (!open) return null
  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && hide()}>
      <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-label="Free job alerts">
        <button type="button" className={styles.close} onClick={hide} aria-label="Close">
          <X aria-hidden width={18} height={18} />
        </button>
        <p className={styles.kicker}>Before you go</p>
        <JobAlertSignup
          filters={{}}
          label={label}
          variant="popup"
          title="Get new $100k+ jobs in your inbox"
          onSuccess={() => write('local', POPUP_STORAGE_KEY, String(Date.now() + POPUP_SIGNUP_SNOOZE_MS))}
        />
      </div>
    </div>
  )
}
