'use client'
import { useState } from 'react'

import s from '../../admin.module.css'

export default function TestAlertButton({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<{ busy: boolean; msg: string | null }>({ busy: false, msg: null })
  async function send() {
    setState({ busy: true, msg: null })
    const res = await fetch('/api/ubaid93/health-alerts', { method: 'POST' })
    const d = await res.json().catch(() => ({}))
    setState({ busy: false, msg: res.ok ? 'Sent. Check your inbox (and spam).' : d?.error ?? 'Could not send.' })
  }
  return (
    <span className={s.actions} style={{ alignItems: 'center', justifyContent: 'flex-start' }}>
      {state.msg ? <span className={s.dim}>{state.msg}</span> : null}
      <button className={s.btn} disabled={disabled || state.busy} onClick={send}>
        {state.busy ? 'Sending…' : 'Send a test email'}
      </button>
    </span>
  )
}
