import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'

import { AutoApplyCancel } from '@/components/autoapply/AutoApplyCancel'
import { AutoApplyReview } from '@/components/autoapply/AutoApplyReview'
import { accountsEnabled } from '@/lib/accounts/enabled'
import { autoApplyEnabled, getAutoApplyCredits } from '@/lib/autoapply/config'
import type { Plan } from '@/lib/autoapply/plan'
import { planHash } from '@/lib/autoapply/state'
import { getSessionUser } from '@/lib/auth/session'
import { getBalance } from '@/lib/billing/credits'
import { prisma } from '@/lib/prisma'

import styles from '@/components/account/account.module.css'

export const metadata: Metadata = {
  title: 'Auto-apply | Six Figure Jobs',
  robots: { index: false, follow: false },
}

const REASONS: Record<string, string> = {
  captcha: 'The employer\'s site asked for a captcha, which we do not solve.',
  security_code: 'The employer\'s site asked for a security code sent to your email.',
  login: 'The employer\'s site asked you to sign in.',
  unexpected_field: 'The form has a required question we do not recognise.',
  validation: 'The employer\'s site rejected something in the form.',
  unconfirmed: 'We sent the form but did not see a confirmation. It may have gone through: check your email before applying again.',
  resume_changed: 'Your résumé changed after you approved this, so we did not send it.',
  plan_changed: 'The application changed after you approved it, so we did not send it.',
  insufficient_credits: 'You did not have enough credits when it was time to send.',
  form_not_found: 'We could not open the employer\'s form.',
  driver_error: 'Something went wrong while filling the form.',
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
    const reason = app.reason ? (REASONS[app.reason] ?? 'It stopped.') : null
    const handBack = app.status === 'needs_user' || app.status === 'failed'
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
        {reason ? <p className={styles.muted}>{reason}</p> : null}
        {handBack ? <p className={styles.muted}>You were not charged. You can finish this one yourself on the employer&apos;s site.</p> : null}
        {safeApply && (handBack || app.status === 'approved') ? (
          <p className={styles.muted}>
            <a href={safeApply} target="_blank" rel="noopener noreferrer nofollow" className={styles.link}>
              Apply on the employer site
            </a>
          </p>
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
