import { redirect } from 'next/navigation'
import { adminUserExists } from '../../../lib/admin/auth'
import SetupForm from './SetupForm'

export default async function SetupPage() {
  const exists = await adminUserExists()
  if (exists) redirect('/ubaid93')

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 16, padding: '40px 48px', width: 400 }}>
        <div style={{ marginBottom: 28 }}>
          <span style={{ background: '#1a2e1a', color: '#84cc16', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 100 }}>
            FIRST-TIME SETUP
          </span>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginTop: 12, marginBottom: 4, color: '#fff' }}>Create Admin Account</h1>
          <p style={{ color: '#555', fontSize: 13, margin: 0 }}>
            This page is only available until an account is created. After setup it will be permanently disabled.
          </p>
        </div>
        <SetupForm />
      </div>
    </div>
  )
}
