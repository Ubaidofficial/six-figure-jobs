import { redirect } from 'next/navigation'
import { getAdminSession } from '../../lib/admin/auth'
import AdminNav from './AdminNav'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = await getAdminSession()
  if (!isLoggedIn) redirect('/admin/login')

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex' }}>
      <AdminNav />
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1200, overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
