import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'

import { AutoApplyCancel } from '@/components/autoapply/AutoApplyCancel'
import { AutoApplyReview } from '@/components/autoapply/AutoApplyReview'
import { accountsEnabled } from '@/lib/accounts/enabled'
import { autoApplyEnabled, getAutoApplyCredits } from '@/lib/autoapply/config'
import { approvedAnswers, type Plan } from '@/lib/autoapply/plan'
import { reasonText } from '@/lib/autoapply/reasons'
import { planHash } from '@/lib/autoapply/state'
import { getSessionUser } from '@/lib/auth/session'
import { getBalance } from '@/lib/billing/credits'
import { prisma } from '@/lib/prisma'

import styles from '@/components/account/account.module.css'

export const metadata: Metadata = {
  title: 'Auto-apply | Six Figure Jobs',
  robots: { index: false, follow: false },
}


export default async function AutoApplyPage({ params }: { params: Promise<{ id: string }> }) {
  await connection()
  if (!accountsEnabled() || !autoApplyEnabled()) notFound()
  const { id } = await params
  const user = await getSessionUser()
  if (!user) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/account/autoapply/${id}`)}`)

  const app = await prisma.autoApplication.findFirst({ where: { id, userId: user.id } })
  if (!app) notFound()
  const cost = getAutoApplyCredits()
  const plan = app.plan as unknown as Plan
  const safeApply = /^https:\/\//i.test(app.applyUrl) ? app.applyUrl : null

  let body: React.ReactNode
  if (app.status === 'draft') {
    const [profile, resume, balance, kit] = await Promise.all([
      prisma.applyProfile.findUnique({ where: { userId: user.id } }),
      prisma.resume.findUnique({ where: { userId: user.id }, select: { text: true } }),
      getBalance(user.id),
      prisma.applicationKit.findUnique({ where: { userId_jobId: { userId: user.id, jobId: app.jobId } }, select: { id: true } }),
    ])
    body = (
      <AutoApplyReview
        id={app.id}
        plan={plan}
        hash={planHash(plan)}
        profile={{
          firstName: profile?.firstName ?? '', lastName: profile?.lastName ?? '', phone: profile?.phone ?? '',
          country: profile?.country ?? '', city: profile?.city ?? '', linkedin: profile?.linkedin ?? '',
          website: profile?.website ?? '', github: profile?.github ?? '',
        }}
        email={user.email ?? ''}
        resumePreview={(resume?.text ?? '').replace(/\s+/g, ' ').slice(0, 120) + ((resume?.text.length ?? 0) > 120 ? '…' : '')}
        hasCoverLetter={Boolean(kit)}
        cost={cost}
        balance={balance}
      />
    )
  } else {
    const handBack = app.status === 'needs_user' || app.status === 'failed'
    const reason = handBack ? reasonText(app.reason) : null
    // Not after an unconfirmed send: it may have gone through, and the user should check before applying again.
    const answers = handBack && app.reason !== 'unconfirmed' ? approvedAnswers(plan) : []
    body = (
      <div className={styles.card}>
        <p className={styles.big}>
          {{ approved: 'Queued', submitting: 'Sending now', submitted: 'Submitted', needs_user: 'Needs you to finish', failed: 'Not sent', cancelled: 'Cancelled' }[app.status as string] ?? app.status}
        </p>
        {app.status === 'approved' ? <p className={styles.muted}>Approved. It is sent the next time the apply worker runs. Nothing is charged until the employer confirms it. You can still cancel.</p> : null}
        {app.status === 'approved' ? <AutoApplyCancel id={app.id} /> : null}
        {app.status === 'submitted' ? (
          <p className={styles.muted}>
            The employer confirmed it{app.finishedAt ? ` on ${app.finishedAt.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' })}` : ''}.{' '}
            {app.charge === 'charged' ? `${cost} credits were used.` : app.charge === 'unpaid' ? 'We could not take the credits afterwards, so this one was free.' : null}
            {app.evidence ? ` Their page said: “${app.evidence.slice(0, 200)}”` : null}
          </p>
        ) : null}
        {reason ? (
          <>
            <p className={styles.muted}>
              <strong>What happened:</strong> {reason.what} You were not charged.
            </p>
            <p className={styles.muted}>
              <strong>What to do:</strong> {reason.next}
            </p>
          </>
        ) : null}
        {safeApply && (handBack || app.status === 'approved') ? (
          <p className={styles.muted}>
            <a href={safeApply} target="_blank" rel="noopener noreferrer nofollow" className={styles.link}>
              {handBack ? 'Open the employer’s form' : 'Apply on the employer site'}
            </a>
          </p>
        ) : null}
        {answers.length > 0 ? (
          <details className={styles.muted}>
            <summary>Your approved answers ({answers.length}), to copy</summary>
            <dl>
              {answers.map((a) => (
                <div key={a.key} style={{ marginTop: 10 }}>
                  <dt style={{ fontWeight: 600 }}>{a.label}</dt>
                  <dd style={{ margin: 0, whiteSpace: 'pre-wrap', userSelect: 'all' }}>{a.text}</dd>
                </div>
              ))}
            </dl>
            <p style={{ marginTop: 12 }}>Attach your résumé file yourself on their form.</p>
          </details>
        ) : null}
      </div>
    )
  }

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Auto-apply</h1>
      <p className={styles.lede}>
        {app.jobTitle} at {app.companyName}.{' '}
        <Link href={`/account/kit/${encodeURIComponent(app.jobSlug)}`} className={styles.link}>
          Application kit
        </Link>
        {' · '}
        <Link href="/account/applications" className={styles.link}>
          Your applications
        </Link>
      </p>
      <div className={styles.stack}>{body}</div>
    </main>
  )
}
