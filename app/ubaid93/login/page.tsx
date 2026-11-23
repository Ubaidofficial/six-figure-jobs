'use client'
import { useState } from 'react'

import s from '../admin.module.css'

export default function AdminLoginPage() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Read directly from DOM to handle Chrome autofill (which bypasses React onChange)
    const form = e.currentTarget
    const username = (form.elements.namedItem('username') as HTMLInputElement)?.value ?? ''
    const password = (form.elements.namedItem('password') as HTMLInputElement)?.value ?? ''

    try {
      const res = await fetch('/api/ubaid93/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (res.ok) {
        // Hard redirect — ensures the browser sends the new httpOnly cookie on the next request
        window.location.href = '/ubaid93'
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data?.setup) {
        window.location.href = '/ubaid93/setup'
        return
      }
      setError(data?.error || 'Invalid username or password')
    } catch {
      setError('Network error — please try again')
    }
    setLoading(false)
  }

  return (
    <div className={s.authWrap}>
      <form onSubmit={handleSubmit} className={`${s.panel} ${s.authCard}`}>
        <div className={s.brand} style={{ padding: 0, border: 0, marginBottom: 22 }}>
          <span className={s.brandMark} aria-hidden>
            6
          </span>
          <span className={s.brandName}>
            Six Figure Jobs
            <span className={s.brandSub}>Admin sign-in</span>
          </span>
        </div>
        <label className={s.field}>
          Username
          <input className={s.input} name="username" type="text" autoFocus required autoComplete="username" />
        </label>
        <label className={s.field}>
          Password
          <input className={s.input} name="password" type="password" required autoComplete="current-password" />
        </label>
        {error ? <p className={s.error} role="alert">{error}</p> : null}
        <button type="submit" disabled={loading} className={`${s.btn} ${s.btnPrimary}`} style={{ width: '100%', justifyContent: 'center', height: 36 }}>
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
