'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

import s from '../admin.module.css'

export default function SetupForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [token, setToken] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    const res = await fetch('/api/ubaid93/setup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password, token }),
    })
    setLoading(false)
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      router.push('/ubaid93')
      router.refresh()
    } else if (data?.loginInstead) {
      router.push('/ubaid93/login')
    } else {
      setError(data?.error ?? 'Setup failed')
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <label className={s.field}>
        Setup token (ADMIN_SETUP_TOKEN in Openship)
        <input className={s.input} type="password" value={token} onChange={(e) => setToken(e.target.value)} required autoComplete="off" />
      </label>
      <label className={s.field}>
        Username
        <input className={s.input} type="text" value={username} onChange={(e) => setUsername(e.target.value)} required autoFocus autoComplete="username" />
      </label>
      <label className={s.field}>
        Password (at least 8 characters)
        <input className={s.input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="new-password" />
      </label>
      <label className={s.field}>
        Confirm password
        <input className={s.input} type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required autoComplete="new-password" />
      </label>
      {error ? <p className={s.error} role="alert">{error}</p> : null}
      <button type="submit" disabled={loading} className={`${s.btn} ${s.btnPrimary}`} style={{ width: '100%', justifyContent: 'center', height: 36 }}>
        {loading ? 'Creating…' : 'Create account'}
      </button>
      <p className={s.cellSub} style={{ textAlign: 'center', marginTop: 14 }}>
        Already created? <Link className={s.link} href="/ubaid93/login">Sign in</Link>
      </p>
    </form>
  )
}
