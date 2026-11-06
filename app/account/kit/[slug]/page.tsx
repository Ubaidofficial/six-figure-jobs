import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { connection } from 'next/server'

import { AutoApplyStart } from '@/components/autoapply/AutoApplyStart'
import { KitView } from '@/components/applykit/KitView'
import { accountsEnabled } from '@/lib/accounts/enabled'
import { findKitJob } from '@/lib/applykit/job'
import { autoApplyEnabled } from '@/lib/autoapply/config'
import { parseGreenhouseUrl } from '@/lib/autoapply/greenhouse'
import { getKitCredits } from '@/lib/applykit/config'
import { getSessionUser } from '@/lib/auth/session'
import { getBalance } from '@/lib/billing/credits'
import { prisma } from '@/lib/prisma'

import styles from '@/components/account/account.module.css'

export const metadata: Metadata = {
  title: 'Application kit | Six Figure Jobs',
  robots: { index: false, follow: false },
}

export default async function KitPage({ params }: { params: Promise<{ slug: string }> }) {
  await connection()
  if (!accountsEnabled()) notFound()
  const { slug: raw } = await params
  const slug = decodeURIComponent(raw)
  const user = await getSessionUser()
  if (!user) redirect(`/sign-in?callbackUrl=${encodeURIComponent(`/account/kit/${raw}`)}`)

  const job = await findKitJob(slug)
  const [resume, kit, balance] = await Promise.all([
    prisma.resume.findUnique({ where: { userId: user.id }, select: { updatedAt: true } }),
    // The job may have expired since the kit was made, so fall back to the slug it was saved under.
    prisma.applicationKit.findFirst({ where: job ? { userId: user.id, jobId: job.id } : { userId: user.id, jobSlug: slug } }),
    getBalance(user.id),
  ])
  if (!job && !kit) notFound()

  const title = job?.title ?? kit!.jobTitle
  const company = job?.company ?? kit!.companyName
  const applyUrl = job?.applyUrl ?? kit?.applyUrl ?? null
  const safeApply = applyUrl && /^https?:\/\//i.test(applyUrl) ? applyUrl : null

  return (
    <main className={styles.page}>
      <h1 className={styles.title}>Application kit</h1>
      <p className={styles.lede}>
        {title} at {company}.{' '}
        <Link href="/account/applications" className={styles.link}>
          Your applications
        </Link>
      </p>
      {safeApply ? (
        <p className={styles.lede}>
          <a href={safeApply} target="_blank" rel="noopener noreferrer nofollow" className={styles.link}>
            Apply on the employer site
          </a>
        </p>
      ) : null}

      <div className={styles.stack}>
        <KitView
          slug={slug}
          kit={kit ? { coverLetter: kit.coverLetter, bullets: kit.bullets as string[], keywordGaps: kit.keywordGaps as string[] } : null}
          canGenerate={Boolean(job)}
          hasResume={Boolean(resume)}
          stale={Boolean(kit && resume && kit.resumeStamp !== String(resume.updatedAt.getTime()))}
          balance={balance}
          cost={getKitCredits()}
        />
      </div>

      {autoApplyEnabled() && job ? (
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>Auto-apply</h2>
          {parseGreenhouseUrl(job.applyUrl) ? (
            <AutoApplyStart slug={slug} />
          ) : (
            <p className={styles.muted}>Auto-apply is not available for this employer yet. Use the employer link above.</p>
          )}
        </div>
      ) : null}
    </main>
  )
}
