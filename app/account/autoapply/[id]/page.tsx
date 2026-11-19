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

import { ChevronRight, ExternalLink, ShieldCheck } from 'lucide-react'

import { ApplySteps, STATUS_VIEW, StatusPill, toneClass } from '@/components/autoapply/AutoApplyStatus'
import { CopyAnswers } from '@/components/autoapply/CopyAnswers'
import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { buildLogoUrl } from '@/lib/companies/logo'
import { cn } from '@/lib/utils'

import a from '@/components/autoapply/autoapply.module.css'
import buttonStyles from '@/components/ui/button.module.css'

// The employer link looks like the primary button (Button renders a <button>, not a link).
const btn = cn(buttonStyles.button, buttonStyles.primary, buttonStyles.md)

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

  const job = await prisma.job
    .findUnique({ where: { id: app.jobId }, select: { companyLogo: true, companyRef: { select: { logoUrl: true, website: true } } } })
    .catch(() => null)
  const logo = buildLogoUrl(job?.companyRef?.logoUrl ?? job?.companyLogo ?? null, job?.companyRef?.website ?? null, app.companyName)
  const when = (d: Date | null) => (d ? d.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }) + ' UTC' : null)

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
          currentCompany: profile?.currentCompany ?? '', currentTitle: profile?.currentTitle ?? '', state: profile?.state ?? '',
          postalCode: profile?.postalCode ?? '', noticePeriod: profile?.noticePeriod ?? '',
          salaryExpectation: profile?.salaryExpectation ?? '', languages: profile?.languages ?? '',
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
    const view = STATUS_VIEW[app.status] ?? STATUS_VIEW.cancelled
    const headline: Record<string, { title: string; text: string }> = {
      approved: { title: 'Queued to send', text: 'It goes out the next time the apply worker runs. Nothing is charged until the employer confirms it, and you can still cancel.' },
      submitting: { title: 'Sending now', text: 'We are filling the employer’s form with the answers you approved. This page shows the result when it is done.' },
      submitted: { title: 'Application sent', text: 'The employer’s own page confirmed they received it.' },
      needs_user: { title: 'Almost there: finish it on their site', text: reason?.what ?? '' },
      failed: { title: 'Not sent', text: reason?.what ?? '' },
      cancelled: { title: 'Cancelled', text: 'Nothing was sent and nothing was charged.' },
    }
    const h = headline[app.status] ?? headline.cancelled
    const timeline = [
      ['Approved', when(app.approvedAt)],
      ['Started', when(app.startedAt)],
      [app.status === 'submitted' ? 'Confirmed' : 'Finished', when(app.finishedAt)],
    ].filter((r): r is [string, string] => Boolean(r[1]))

    body = (
      <div className={a.layout}>
        <div className={a.main}>
          <section className={a.card} aria-labelledby="result-h">
            <div className={a.result}>
              <span className={cn(a.resultIcon, toneClass(view.tone))}>
                <view.Icon aria-hidden />
              </span>
              <div>
                <h2 id="result-h" className={a.resultTitle}>
                  {h.title}
                </h2>
                {h.text ? <p className={a.resultText}>{h.text}</p> : null}
                {app.status === 'submitted' ? (
                  <>
                    <p className={a.resultText}>
                      {app.charge === 'charged'
                        ? `${cost} ${cost === 1 ? 'credit was' : 'credits were'} used.`
                        : app.charge === 'unpaid'
                          ? 'We could not take the credits afterwards, so this one was free.'
                          : null}
                    </p>
                    {app.evidence ? <blockquote className={a.quote}>“{app.evidence.slice(0, 240)}”</blockquote> : null}
                  </>
                ) : null}
              </div>
            </div>


            {reason ? (
              <div className={a.callouts}>
                <div className={a.callout}>
                  <div className={a.calloutLabel}>What to do</div>
                  <p className={a.calloutText}>{reason.next}</p>
                </div>
                <div className={a.callout}>
                  <div className={a.calloutLabel}>What it cost</div>
                  <p className={a.calloutText}>Nothing. You are only charged when an employer confirms an application we sent.</p>
                </div>
              </div>
            ) : null}

            <div className={a.cta}>
              {safeApply && (handBack || app.status === 'approved') ? (
                <a href={safeApply} target="_blank" rel="noopener noreferrer nofollow" className={btn}>
                  Open the employer’s form <ExternalLink size={16} aria-hidden />
                </a>
              ) : null}
              {app.status === 'approved' ? <AutoApplyCancel id={app.id} /> : null}
            </div>
          </section>

          {answers.length > 0 ? (
            <section className={a.card} aria-labelledby="answers-h">
              <div className={a.cardHead}>
                <div>
                  <h2 id="answers-h" className={a.cardTitle}>
                    Your approved answers
                  </h2>
                  <p className={a.cardHint}>Copy them into the employer’s form. Attach your résumé file there yourself.</p>
                </div>
              </div>
              <CopyAnswers answers={answers} />
            </section>
          ) : null}
        </div>

        <aside className={a.aside} aria-label="Details">
          <div className={a.card}>
            <h2 className={a.sumTitle}>Timeline</h2>
            {timeline.length ? (
              <ul className={a.timeline}>
                {timeline.map(([label, t]) => (
                  <li key={label}>
                    <span>{label}</span>
                    <time>{t}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={a.cardHint}>Nothing has run yet.</p>
            )}
          </div>
          <div className={a.guarantee}>
            <ShieldCheck aria-hidden />
            <div>
              <strong>Charged only when the employer confirms.</strong>Anything we cannot finish safely comes back to you,
              free.
            </div>
          </div>
        </aside>
      </div>
    )
  }

  return (
    <main className={a.page}>
      <nav className={a.crumbs} aria-label="Breadcrumb">
        <Link href="/account/applications">Your applications</Link>
        <ChevronRight size={14} aria-hidden />
        <span>Auto-apply</span>
      </nav>
      <header className={a.head}>
        <CompanyLogo name={app.companyName} src={logo} size="lg" />
        <div className={a.headText}>
          <p className={a.kicker}>Auto-apply</p>
          <h1 className={a.title}>{app.jobTitle}</h1>
          <p className={a.sub}>
            {app.companyName} ·{' '}
            <Link href={`/account/kit/${encodeURIComponent(app.jobSlug)}`}>Application kit</Link>
          </p>
        </div>
        <StatusPill status={app.status} />
      </header>
      <ApplySteps status={app.status} />
      {body}
    </main>
  )
}
