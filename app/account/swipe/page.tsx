// Swipe through $100k+ jobs one at a time. Right makes a free auto-apply draft for that job, left skips it. Nothing is sent
// until the user reviews and approves each draft (/account/autoapply/<id>). Signed-in users only, and only while hosted
// auto-apply is switched on (otherwise 404, like the rest of auto-apply). Never indexed.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { FileText, ShieldCheck } from 'lucide-react'

import { SwipeDeck, type QueueItem } from '@/components/autoapply/SwipeDeck'
import { accountsEnabled } from '@/lib/accounts/enabled'
import { autoApplyEnabled, getAutoApplyCredits } from '@/lib/autoapply/config'
import { swipeDeck, type SwipeCard } from '@/lib/autoapply/deck'
import { getSessionUser } from '@/lib/auth/session'
import { getBalance } from '@/lib/billing/credits'
import { prisma } from '@/lib/prisma'

import a from '@/components/autoapply/autoapply.module.css'

export const metadata: Metadata = {
  title: 'Swipe to apply | Six Figure Jobs',
  robots: { index: false, follow: false },
}

export default async function SwipePage() {
  await connection()
  if (!accountsEnabled() || !autoApplyEnabled()) notFound()
  const user = await getSessionUser()
  if (!user) redirect(`/sign-in?callbackUrl=${encodeURIComponent('/account/swipe')}`)

  const [resume, queue, balance] = await Promise.all([
    prisma.resume.findUnique({ where: { userId: user.id }, select: { userId: true } }),
    prisma.autoApplication.findMany({
      where: { userId: user.id, status: { in: ['draft', 'approved', 'submitting'] } },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, jobTitle: true, companyName: true, status: true },
    }),
    getBalance(user.id).catch(() => 0),
  ])
  const cards: SwipeCard[] = resume ? await swipeDeck(user.id, {}).catch(() => []) : []
  const items: QueueItem[] = queue.map((q) => ({ id: q.id, key: q.id, title: q.jobTitle, company: q.companyName, status: q.status }))

  return (
    <main className={a.page}>
      <p className={a.kicker}>Auto-apply</p>
      <h1 className={a.title}>Swipe to apply</h1>
      <p className={a.sub} style={{ maxWidth: 640 }}>
        One $100k+ job at a time, all with forms we can fill. Swipe right and we prepare the application with your details
        and résumé. You check every answer and approve it before anything is sent.
      </p>

      {resume ? (
        <SwipeDeck initialCards={cards} initialQueue={items} cost={getAutoApplyCredits()} balance={balance} />
      ) : (
        <section className={a.card} style={{ marginTop: 'var(--space-32)', maxWidth: 560 }}>
          <div className={a.result}>
            <span className={a.resultIcon} style={{ background: 'var(--color-bg-2)' }}>
              <FileText aria-hidden />
            </span>
            <div>
              <h2 className={a.resultTitle}>Add your résumé first</h2>
              <p className={a.resultText}>
                It is what we attach to every application you approve. Paste it once on your applications page, then come
                back to start swiping.
              </p>
              <div className={a.cta}>
                <Link href="/account/applications" className={a.copy} style={{ fontSize: 'var(--text-sm)', padding: '10px 16px' }}>
                  Add my résumé
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      <p className={a.note} style={{ maxWidth: 640, marginTop: 'var(--space-32)' }}>
        <ShieldCheck aria-hidden />
        <span>
          We never answer work authorization, sponsorship or similar questions for you, never get past a captcha, and only
          charge when the employer confirms an application we sent.
        </span>
      </p>
    </main>
  )
}
