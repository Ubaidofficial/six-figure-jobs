import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { getAdminSession } from '../../../lib/admin/auth'
import { prisma } from '../../../lib/prisma'
import s from '../admin.module.css'
import AdminNav from './AdminNav'
import { countReviewQueue } from '../../../lib/admin/reviewQueue'
import { countNewErrorGroups } from './errors/groups'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Admin · Six Figure Jobs',
  robots: { index: false, follow: false },
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const isLoggedIn = await getAdminSession()
  if (!isLoggedIn) redirect('/ubaid93/login')
  // Counts shown beside Feedback, Errors and Review on every page, so new items are seen without opening the lists.
  const [feedback, errors, review] = await Promise.all([
    prisma.feedback.count({ where: { status: 'new' } }).catch(() => 0),
    countNewErrorGroups().catch(() => 0),
    countReviewQueue({ cached: true })
      .then((c) => c.pay + c.titles)
      .catch(() => 0),
  ])

  return (
    <div className={s.shell}>
      <AdminNav counts={{ feedback, errors, review }} />
      <main className={s.main}>{children}</main>
    </div>
  )
}
