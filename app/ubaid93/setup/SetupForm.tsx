'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a',
  borderRadius: 8, color: '#fff', fontSize: 15, boxSizing: 'border-box', display: 'block',
}

export default function SetupForm() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
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
      body: JSON.stringify({ username, password }),
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
      <label style={{ display: 'block', fontSize: 13, color: '#a3a3a3', marginBottom: 6 }}>Username</label>
      <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
        required autoFocus autoComplete="username" placeholder="e.g. ubaid"
        style={{ ...inputStyle, marginBottom: 14 }} />

      <label style={{ display: 'block', fontSize: 13, color: '#a3a3a3', marginBottom: 6 }}>Password</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
        required autoComplete="new-password" placeholder="Min. 8 characters"
        style={{ ...inputStyle, marginBottom: 14 }} />

      <label style={{ display: 'block', fontSize: 13, color: '#a3a3a3', marginBottom: 6 }}>Confirm Password</label>
      <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
        required autoComplete="new-password"
        style={{ ...inputStyle, marginBottom: 16 }} />

      {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}

      <button type="submit" disabled={loading} style={{
        width: '100%', padding: '10px', background: '#84cc16', color: '#000', fontWeight: 700,
        fontSize: 15, border: 'none', borderRadius: 8, cursor: 'pointer',
      }}>
        {loading ? 'Creating account...' : 'Create account'}
      </button>
      <p style={{ textAlign: 'center', marginTop: 14, fontSize: 12, color: '#555' }}>
        Account already created?{' '}
        <Link href="/ubaid93/login" style={{ color: '#84cc16' }}>Sign in →</Link>
      </p>
    </form>
  )
}
