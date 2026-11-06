import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'

import { ResumeForm } from '@/components/applykit/ResumeForm'
import { TrackerList } from '@/components/applykit/TrackerList'
import { accountsEnabled } from '@/lib/accounts/enabled'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

import styles from '@/components/account/account.module.css'

// Private page: noindex, no canonical, no hreflang. Reading the session cookie keeps it dynamic.
export const metadata: Metadata = {
  title: 'Your applications | Six Figure Jobs',
  robots: { index: false, follow: false },
}

export default async function ApplicationsPage() {
  await connection()
  if (!accountsEnabled()) notFound()
  const user = await getSessionUser()
  if (!user) redirect('/sign-in?callbackUrl=%2Faccount%2Fapplications')

  const [resume, kits] = await Promise.all([
    prisma.resume.findUnique({ where: { userId: user.id }, select: { text: true } }),
    prisma.applicationKit.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, jobSlug: true, jobTitle: true, companyName: true, applyUrl: true, status: true, notes: true, createdAt: true },
    }),
  ])

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Your applications</h1>
      <p className={styles.lede}>
        Keep your résumé here, make a cover letter and tailored bullets for any job, and track where you applied.{' '}
        <Link href="/account" className={styles.link}>
          Back to your account
        </Link>
      </p>

      <section className={styles.card} aria-labelledby="resume-heading">
        <h2 id="resume-heading" className={styles.cardTitle}>
          Résumé
        </h2>
        <ResumeForm initialText={resume?.text ?? ''} />
      </section>

      <section className={styles.card} aria-labelledby="tracker-heading">
        <h2 id="tracker-heading" className={styles.cardTitle}>
          Tracker
        </h2>
        <TrackerList
          rows={kits.map((k) => ({ ...k, notes: k.notes ?? '', createdAt: k.createdAt.toISOString() }))}
        />
      </section>
    </main>
  )
}
