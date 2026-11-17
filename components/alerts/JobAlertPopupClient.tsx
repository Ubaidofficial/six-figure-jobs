'use client'

// A small card in the bottom corner that offers the free job alert. Not a full-screen overlay and not shown at once: it
// waits until the visitor has read for a while or scrolled, appears once per visit, and a dismissal or signup keeps it away
// for weeks (rules in lib/alerts/popup.ts). It is added after load, so it is not in the server HTML and changes no crawled
// markup, canonical, hreflang or JSON-LD.
import * as React from 'react'
import { usePathname } from 'next/navigation'
import { X } from 'lucide-react'

import {
  POPUP_DELAY_MS,
  POPUP_DISMISS_SNOOZE_MS,
  POPUP_SCROLL_RATIO,
  POPUP_SESSION_KEY,
  POPUP_SIGNUP_SNOOZE_MS,
  POPUP_STORAGE_KEY,
  popupAllowedOnPath,
  popupIsSnoozed,
} from '@/lib/alerts/popup'

import { JobAlertSignup } from './JobAlertSignup'
import styles from './JobAlertPopup.module.css'

// Storage can throw (private windows, blocked site data); the popup then simply behaves as if nothing was stored.
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

export function JobAlertPopupClient({ label }: { label: string }) {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  // Arm on every allowed page; the first of "read for a while" and "scrolled half way" opens it.
  React.useEffect(() => {
    setOpen(false)
    if (!popupAllowedOnPath(pathname)) return
    if (popupIsSnoozed(read('local', POPUP_STORAGE_KEY), Date.now()) || read('session', POPUP_SESSION_KEY)) return

    const show = () => {
      cleanup()
      write('session', POPUP_SESSION_KEY, '1')
      setOpen(true)
    }
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      if (scrollable > 0 && window.scrollY / scrollable >= POPUP_SCROLL_RATIO) show()
    }
    const timer = window.setTimeout(show, POPUP_DELAY_MS)
    const cleanup = () => {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return cleanup
  }, [pathname])

  const hide = React.useCallback((snoozeMs: number) => {
    write('local', POPUP_STORAGE_KEY, String(Date.now() + snoozeMs))
    setOpen(false)
  }, [])

  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') hide(POPUP_DISMISS_SNOOZE_MS)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, hide])

  if (!open) return null
  return (
    <aside className={styles.card} role="dialog" aria-modal="false" aria-label="Free job alerts">
      <button type="button" className={styles.close} onClick={() => hide(POPUP_DISMISS_SNOOZE_MS)} aria-label="Close">
        <X aria-hidden width={16} height={16} />
      </button>
      <JobAlertSignup filters={{}} label={label} variant="popup" onSuccess={() => write('local', POPUP_STORAGE_KEY, String(Date.now() + POPUP_SIGNUP_SNOOZE_MS))} />
    </aside>
  )
}
