import { redirect } from 'next/navigation'
import { getAdminSession } from '../../../lib/admin/auth'
import { prisma } from '../../../lib/prisma'
import AdminNav from './AdminNav'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = await getAdminSession()
  if (!isLoggedIn) redirect('/ubaid93/login')
  // Unread feedback, shown as a badge on every admin page so new feedback is seen without opening the list.
  const newFeedback = await prisma.feedback.count({ where: { status: 'new' } }).catch(() => 0)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex' }}>
      <AdminNav newFeedback={newFeedback} />
      <main style={{ flex: 1, padding: '32px 40px', maxWidth: 1200, overflowX: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
