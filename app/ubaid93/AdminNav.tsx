'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const links = [
  { href: '/ubaid93', label: 'Dashboard', icon: '◉' },
  { href: '/ubaid93/feedback', label: 'Feedback', icon: '💬' },
  { href: '/ubaid93/jobs', label: 'Jobs', icon: '💼' },
  { href: '/ubaid93/config', label: 'Site Config', icon: '⚙️' },
]

export default function AdminNav() {
  const pathname = usePathname()
  const router = useRouter()

  async function logout() {
    await fetch('/api/ubaid93/logout', { method: 'POST' })
    router.push('/ubaid93/login')
    router.refresh()
  }

  return (
    <nav style={{
      width: 220, background: '#0f0f0f', borderRight: '1px solid #1f1f1f',
      padding: '28px 0', display: 'flex', flexDirection: 'column', flexShrink: 0, minHeight: '100vh',
    }}>
      <div style={{ padding: '0 20px 28px', borderBottom: '1px solid #1f1f1f' }}>
        <span style={{ fontWeight: 800, fontSize: 15, color: '#84cc16' }}>Six Figure Jobs</span>
        <p style={{ color: '#555', fontSize: 12, margin: '4px 0 0' }}>Admin Panel</p>
      </div>
      <div style={{ flex: 1, padding: '16px 0' }}>
        {links.map((l) => {
          const active = l.href === '/ubaid93' ? pathname === '/ubaid93' : pathname.startsWith(l.href)
          return (
            <Link
              key={l.href}
              href={l.href}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px',
                color: active ? '#84cc16' : '#a3a3a3', textDecoration: 'none', fontSize: 14,
                background: active ? '#1a2e1a' : 'transparent', fontWeight: active ? 600 : 400,
              }}
            >
              <span style={{ fontSize: 16 }}>{l.icon}</span>
              {l.label}
            </Link>
          )
        })}
      </div>
      <div style={{ padding: '16px 20px', borderTop: '1px solid #1f1f1f' }}>
        <button
          onClick={logout}
          style={{
            width: '100%', padding: '8px', background: 'transparent', border: '1px solid #2a2a2a',
            borderRadius: 8, color: '#666', fontSize: 13, cursor: 'pointer',
          }}
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
