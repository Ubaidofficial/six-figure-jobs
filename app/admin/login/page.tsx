'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    setLoading(false)
    if (res.ok) {
      router.push('/admin')
      router.refresh()
    } else {
      setError('Invalid password')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <form onSubmit={handleSubmit} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 16, padding: '40px 48px', width: 360 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: '#fff' }}>Admin Login</h1>
        <p style={{ color: '#666', fontSize: 14, marginBottom: 28 }}>Six Figure Jobs</p>
        <label style={{ display: 'block', fontSize: 13, color: '#a3a3a3', marginBottom: 6 }}>Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          required
          style={{
            width: '100%', padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a',
            borderRadius: 8, color: '#fff', fontSize: 15, boxSizing: 'border-box', marginBottom: 16,
          }}
        />
        {error && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{error}</p>}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: '100%', padding: '10px', background: '#84cc16', color: '#000', fontWeight: 700,
            fontSize: 15, border: 'none', borderRadius: 8, cursor: 'pointer',
          }}
        >
          {loading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </div>
  )
}
