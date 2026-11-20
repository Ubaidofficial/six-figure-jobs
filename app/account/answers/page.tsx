// The user's saved answers to employers' questions: what auto-apply may offer again on later applications (always for
// the user to tick first). Signed-in only, and only while hosted auto-apply is switched on. Never indexed.
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'
import { ChevronRight, ShieldCheck } from 'lucide-react'

import { AccountTabs } from '@/components/account/AccountTabs'
import { SavedAnswers } from '@/components/autoapply/SavedAnswers'
import { autoApplyEnabled } from '@/lib/autoapply/config'
import { getSessionUser } from '@/lib/auth/session'
import { prisma } from '@/lib/prisma'

import a from '@/components/autoapply/autoapply.module.css'

export const metadata: Metadata = {
  title: 'Saved answers | Six Figure Jobs',
  robots: { index: false, follow: false },
}

export default async function SavedAnswersPage() {
  await connection()
  if (!autoApplyEnabled()) notFound()
  const user = await getSessionUser()
  if (!user) redirect(`/sign-in?callbackUrl=${encodeURIComponent('/account/answers')}`)

  const rows = await prisma.savedAnswer
    .findMany({ where: { userId: user.id }, orderBy: { updatedAt: 'desc' }, take: 500, select: { id: true, question: true, answer: true, updatedAt: true } })
    .catch(() => [])

  return (
    <main className={a.page} style={{ maxWidth: 820 }}>
      <nav className={a.crumbs} aria-label="Breadcrumb">
        <Link href="/account/applications">Your applications</Link>
        <ChevronRight size={14} aria-hidden />
        <span>Saved answers</span>
      </nav>
      <p className={a.kicker} style={{ marginTop: 'var(--space-20)' }}>
        Auto-apply
      </p>
      <h1 className={a.title}>Saved answers</h1>
      <p className={a.sub} style={{ maxWidth: 640 }}>
        Your answers to employers&apos; questions. When the same question comes up again, we fill it in for you to check and
        tick before you approve. Nothing here is ever sent without that tick.
      </p>
      <section className={a.card} style={{ marginTop: 'var(--space-24)' }}>
        <SavedAnswers
          initial={rows.map((r) => ({
            id: r.id,
            question: r.question,
            text: Array.isArray(r.answer) ? (r.answer as string[]).join(', ') : String(r.answer),
            updated: r.updatedAt.toLocaleDateString('en-US', { dateStyle: 'medium', timeZone: 'UTC' }),
          }))}
        />
      </section>
      <p className={a.note} style={{ maxWidth: 640 }}>
        <ShieldCheck aria-hidden />
        <span>
          Questions about gender, race, veteran or disability status are never saved. To stop saving answers, untick
          &ldquo;Save my answers&rdquo; on an application.
        </span>
      </p>
      <AccountTabs />
    </main>
  )
}
