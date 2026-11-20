import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'

import { AccountTabs } from '@/components/account/AccountTabs'
import { ResumeForm } from '@/components/applykit/ResumeForm'
import { TrackerList } from '@/components/applykit/TrackerList'
import { accountsEnabled } from '@/lib/accounts/enabled'
import { autoApplyEnabled } from '@/lib/autoapply/config'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

import styles from '@/components/account/account.module.css'

// Private page: noindex, no canonical, no hreflang. Reading the session cookie keeps it dynamic.
export const metadata: Metadata = {
  title: 'Your applications | Six Figure Jobs',
  robots: { index: false, follow: false },
}

// How each auto-apply state reads in the list (statuses: lib/autoapply, AutoApplication.status).
const AUTO_STATUS: Record<string, string> = {
  draft: 'Review',
  approved: 'Queued',
  submitting: 'Sending',
  submitted: 'Sent',
  needs_user: 'Needs you',
  failed: 'Not sent',
}

export default async function ApplicationsPage() {
  await connection()
  if (!accountsEnabled()) notFound()
  const user = await getSessionUser()
  if (!user) redirect('/sign-in?callbackUrl=%2Faccount%2Fapplications')

  const showAuto = autoApplyEnabled()
  const [resume, kits, autoApps] = await Promise.all([
    prisma.resume.findUnique({ where: { userId: user.id }, select: { text: true } }),
    prisma.applicationKit.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: 'desc' },
      take: 200,
      select: { id: true, jobSlug: true, jobTitle: true, companyName: true, applyUrl: true, status: true, notes: true, createdAt: true },
    }),
    // Auto-apply applications, newest first: the "Applied" tab on phones lands here.
    showAuto
      ? prisma.autoApplication.findMany({
          where: { userId: user.id, status: { not: 'cancelled' } },
          orderBy: { createdAt: 'desc' },
          take: 100,
          select: { id: true, jobTitle: true, companyName: true, status: true, createdAt: true },
        })
      : Promise.resolve([]),
  ])

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Your applications</h1>
      <p className={styles.lede}>
        Keep your résumé here, make a cover letter and tailored bullets for any job, and track where you applied.{' '}
        <Link href="/account" className={styles.link}>
          Back to your account
        </Link>
        {autoApplyEnabled() ? (
          <>
            {' · '}
            <Link href="/account/swipe" className={styles.link}>
              Swipe to apply
            </Link>
            {' · '}
            <Link href="/account/answers" className={styles.link}>
              Saved answers
            </Link>
          </>
        ) : null}
      </p>

      {showAuto ? (
        <section className={styles.card} aria-labelledby="auto-heading">
          <h2 id="auto-heading" className={styles.cardTitle}>
            Auto-apply
          </h2>
          {autoApps.length === 0 ? (
            <p className={styles.muted}>
              Nothing yet.{' '}
              <Link href="/account/swipe" className={styles.link}>
                Swipe to apply
              </Link>{' '}
              to prepare your first application.
            </p>
          ) : (
            <ul className={styles.autoList}>
              {autoApps.map((app) => (
                <li key={app.id} className={styles.autoItem}>
                  <Link href={`/account/autoapply/${app.id}`} className={styles.autoLink}>
                    <span className={styles.autoJob}>{app.jobTitle}</span>
                    <span className={styles.autoCo}>
                      {app.companyName} · {app.createdAt.toISOString().slice(0, 10)}
                    </span>
                  </Link>
                  <span className={styles.autoStatus} data-status={app.status}>
                    {AUTO_STATUS[app.status] ?? app.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

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
      {showAuto ? <AccountTabs queueCount={autoApps.filter((a) => a.status === 'draft').length} /> : null}
    </main>
  )
}
