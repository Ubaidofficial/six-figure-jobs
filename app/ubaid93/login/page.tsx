'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a',
  borderRadius: 8, color: '#fff', fontSize: 15, boxSizing: 'border-box', display: 'block',
}
const btnStyle: React.CSSProperties = {
  width: '100%', padding: '10px', background: '#84cc16', color: '#000', fontWeight: 700,
  fontSize: 15, border: 'none', borderRadius: 8, cursor: 'pointer',
}

export default function AdminLoginPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/ubaid93/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/ubaid93')
      router.refresh()
    } else {
      const data = await res.json().catch(() => ({}))
      if (data?.setup) {
        router.push('/ubaid93/setup')
      } else {
        setError('Invalid username or password')
      }
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 16, padding: '40px 48px', width: 380 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: '#fff' }}>Admin Login</h1>
        <p style={{ color: '#555', fontSize: 13, marginBottom: 28 }}>Six Figure Jobs</p>

        <label style={{ display: 'block', fontSize: 13, color: '#a3a3a3', marginBottom: 6 }}>Username</label>
        <input type="text" value={username} onChange={(e) => setUsername(e.target.value)}
          autoFocus required autoComplete="username" style={{ ...inputStyle, marginBottom: 14 }} />

        <label style={{ display: 'block', fontSize: 13, color: '#a3a3a3', marginBottom: 6 }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          required autoComplete="current-password" style={{ ...inputStyle, marginBottom: 16 }} />

        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button type="submit" disabled={loading} style={btnStyle}>
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: '#555' }}>
          No account?{' '}
          <Link href="/ubaid93/setup" style={{ color: '#84cc16' }}>Create admin account →</Link>
        </p>
      </form>
    </div>
  )
}
