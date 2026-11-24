'use client'
// Runs an admin action (a PATCH to one of the /api/ubaid93 routes), refreshes the page on success, and keeps the
// reason when it fails, so a failed click never looks like a successful one or leaves its button stuck.
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import s from '../admin.module.css'

export function useAction() {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)

  async function run(key: string, url: string, body: Record<string, unknown>, { refresh = true } = {}): Promise<boolean> {
    setBusy(key)
    setFailed(null)
    try {
      const res = await fetch(url, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setFailed(d?.error ? `Not done: ${d.error}` : `Not done (the server answered ${res.status}).`)
        return false
      }
      if (refresh) router.refresh()
      return true
    } catch {
      setFailed('Not done: the request did not reach the server.')
      return false
    } finally {
      setBusy(null)
    }
  }

  return { busy, failed, run, refresh: () => router.refresh() }
}

export function ActionError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p className={s.error} role="alert" style={{ margin: 0, padding: '10px 14px', borderBottom: '1px solid var(--color-border)' }}>
      {message}
    </p>
  )
}
