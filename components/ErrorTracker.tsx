'use client'
import { useEffect } from 'react'

export default function ErrorTracker() {
  useEffect(() => {
    function logError(message: string, stack?: string, context?: Record<string, unknown>) {
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          stack,
          url: window.location.href,
          context,
          severity: 'error',
        }),
      }).catch(() => {})
    }

    function onError(event: ErrorEvent) {
      logError(event.message, event.error?.stack, {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      })
    }

    function onUnhandledRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      const message = reason instanceof Error ? reason.message : String(reason)
      const stack = reason instanceof Error ? reason.stack : undefined
      logError(`Unhandled promise rejection: ${message}`, stack)
    }

    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onUnhandledRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onUnhandledRejection)
    }
  }, [])

  return null
}
