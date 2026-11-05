// Building blocks for the job detail page. Server components on shadcn's Card/Badge/Separator, styled with
// the site's theme tokens. The page keeps rendering on the server; only the logo and save/share buttons hydrate.
import type { ReactNode } from 'react'
import NextLink from 'next/link'
import { BadgeCheck, ExternalLink, Globe } from 'lucide-react'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { SalaryRank } from '@/lib/jobs/salaryRank'
import type { DescriptionSection } from '@/lib/jobs/descriptionStructure'
import type { ApplySurface } from '@/lib/analytics/applyClick'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

import styles from './JobDetail.module.css'

import { JobActions } from './JobActions'
import { ApplyLink } from './ApplyLink'
import { ReportJob } from './ReportJob'
import { MobileBarShell } from './MobileBarShell'

type Fact = { label: string; value: string }

const applyButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-md bg-[var(--color-primary)] px-4 py-3 text-sm font-semibold text-neutral-950 transition-colors hover:bg-[var(--color-primary-light)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'

export function ApplyButton({
  href,
  label,
  className,
  jobId,
  surface,
}: {
  href: string
  label: string
  className?: string
  jobId: string
  surface: ApplySurface
}) {
  return (
    <ApplyLink href={href} jobId={jobId} surface={surface} className={cn(applyButtonClass, className)}>
      {label} <ExternalLink className="size-4" aria-hidden="true" />
    </ApplyLink>
  )
}

/** Section of the article: a real heading, then content. No card chrome, so the page reads top to bottom. */
export function JobSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

/**
 * The posting's description as labelled sections. A jump list appears once there are three or more, so a long posting
 * can be scanned and the reader can go straight to "Minimum qualifications"; boilerplate (equal opportunity, privacy)
 * is folded into a <details> so it does not sit between the reader and the apply button. The text itself is already
 * sanitized by the page.
 */
export function DescriptionSections({ sections }: { sections: DescriptionSection[] }) {
  const jumpable = sections.filter((s) => !s.folded)
  return (
    <div className="space-y-2">
      {jumpable.length >= 3 ? (
        <nav aria-label="In this description" className={styles.jumpNav}>
          <ul>
            {jumpable.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
      {sections.map((s) =>
        s.folded ? (
          <details key={s.id} id={s.id} className={styles.foldedSection}>
            <summary>{s.title}</summary>
            <div className={`prose max-w-none ${styles.richText}`} dangerouslySetInnerHTML={{ __html: s.html }} />
          </details>
        ) : (
          <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className={styles.descSection}>
            <h3 id={`${s.id}-title`} className={styles.descHeading}>
              {s.title}
            </h3>
            <div className={`prose max-w-none ${styles.richText}`} dangerouslySetInnerHTML={{ __html: s.html }} />
          </section>
        ),
      )}
    </div>
  )
}

/** Apply button after the description: the reader who has just finished it should not have to scroll back up. */
export function DescriptionApply({ applyHref, companyName, jobId }: { applyHref: string | null; companyName: string; jobId: string }) {
  if (!applyHref) return null
  return (
    <div className={styles.descApply}>
      <ApplyButton href={applyHref} label="Apply on company site" jobId={jobId} surface="description-end" />
      <p>Opens {companyName}&rsquo;s own application page in a new tab.</p>
    </div>
  )
}

export function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-foreground/90 marker:text-primary">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  )
}

/** Right-rail card: the numbers that decide whether to apply, and the one button to do it. */
export function ApplyCard({
  applyHref,
  companyName,
  facts,
  jobId,
  shareUrl,
}: {
  applyHref: string | null
  companyName: string
  facts: Fact[]
  jobId: string
  shareUrl: string
}) {
  return (
    <Card className="rounded-3xl p-6">
      <h2 className={styles.sideTitle}>Ready to apply?</h2>

      {applyHref ? (
        <>
          <ApplyButton href={applyHref} label="Apply on company site" className="mt-4 w-full" jobId={jobId} surface="apply-card" />
          <p className="mt-2 text-xs text-muted-foreground">
            Opens {companyName}&rsquo;s own application page in a new tab. We only count that the button was clicked (no cookies, nothing about you).
          </p>
        </>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">This listing has no application link right now.</p>
      )}

      {facts.length > 0 ? (
        <>
          <Separator className="my-5" />
          <dl className="space-y-3 text-sm">
            {facts.map((f) => (
              <div key={f.label} className="flex items-baseline justify-between gap-4">
                <dt className="text-muted-foreground">{f.label}</dt>
                <dd className="text-right font-medium text-foreground">{f.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}

      <Separator className="my-5" />
      <div className="flex items-center gap-2">
        <JobActions jobId={jobId} shareUrl={shareUrl} />
      </div>
      <div className="mt-4">
        <ReportJob jobId={jobId} />
      </div>
    </Card>
  )
}

/** The white card inside the hero: the salary, how it compares with similar roles, and the Apply button. */
export function PayCard({
  salaryText,
  salaryIsFromEmployer,
  rank,
  roleLabel,
  currency,
  applyHref,
  jobId,
}: {
  salaryText: string | null
  salaryIsFromEmployer: boolean
  rank: SalaryRank | null
  /** Who the rank is among: "software engineer", or "six-figure" when it is every listing. */
  roleLabel: string | null
  currency: string | null
  applyHref: string | null
  jobId: string
}) {
  return (
    <div id="job-pay-card" className={styles.payCard}>
      <h2 className={styles.payLabel}>Salary</h2>
      <p className={styles.payAmount}>{salaryText || 'Not disclosed'}</p>
      {salaryText ? (
        <p className={styles.payNote}>
          <BadgeCheck className="size-4 text-primary" aria-hidden="true" />
          {salaryIsFromEmployer ? 'From the employer’s posting' : 'Listed in the posting'}
        </p>
      ) : null}

      {rank && roleLabel && currency ? (
        <div className={styles.insight}>
          <p className={styles.insightText}>
            Pays more than <strong>{rank.percent}%</strong> of {rank.peers.toLocaleString()} {roleLabel} listings in {currency}.
          </p>
          <div className={styles.rankTrack} role="img" aria-label={`Higher than ${rank.percent} percent of comparable listings`}>
            <span className={styles.rankFill} style={{ width: `${Math.max(3, rank.percent)}%` }} />
            <span className={styles.rankMarker} style={{ left: `${Math.min(97, Math.max(3, rank.percent))}%` }} />
          </div>
          <p className={styles.insightNote}>
            Typical for {roleLabel === 'six-figure' ? 'six-figure listings' : 'this role'}: {formatCurrencyShort(Math.round(rank.median / 1000) * 1000, currency)}
          </p>
        </div>
      ) : null}

      {applyHref ? (
        <ApplyButton href={applyHref} label="Apply on company site" className="mt-5 w-full" jobId={jobId} surface="hero" />
      ) : null}
    </div>
  )
}

export function CompanyCard({
  name,
  slug,
  logoSrc,
  description,
  facts,
  websiteHref,
}: {
  name: string
  slug: string | null
  logoSrc: string | null
  description: string | null
  facts: Fact[]
  websiteHref: string | null
}) {
  return (
    <Card className="rounded-3xl p-6">
      <div className="flex items-center gap-3">
        <CompanyLogo name={name} src={logoSrc} size="lg" />
        <div className="min-w-0">
          <h2 className="truncate text-base font-semibold text-foreground">{name}</h2>
          {slug ? (
            <NextLink href={`/company/${slug}`} className="text-sm text-primary hover:underline underline-offset-4">
              All jobs at {name}
            </NextLink>
          ) : null}
        </div>
      </div>

      {description ? (
        <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-muted-foreground">{description}</p>
      ) : null}

      {facts.length > 0 ? (
        <dl className="mt-4 space-y-2 text-sm">
          {facts.map((f) => (
            <div key={f.label} className="flex items-baseline justify-between gap-4">
              <dt className="text-muted-foreground">{f.label}</dt>
              <dd className="text-right font-medium text-foreground">{f.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {websiteHref ? (
        <a
          href={websiteHref}
          target="_blank"
          rel="nofollow noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <Globe className="size-4" aria-hidden="true" /> Company website
        </a>
      ) : null}
    </Card>
  )
}

/** Sticky bar for phones: salary plus the Apply button. Shown once the hero's own Apply button has scrolled away. */
export function MobileApplyBar({
  salaryText,
  applyHref,
  jobId,
}: {
  salaryText: string | null
  applyHref: string | null
  jobId: string
}) {
  if (!applyHref) return null
  return (
    <MobileBarShell>
      <div className="mx-auto flex max-w-[1600px] items-center gap-3 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Salary</p>
          <p className="truncate font-mono text-base font-semibold text-foreground">{salaryText || 'Not disclosed'}</p>
        </div>
        <ApplyButton href={applyHref} label="Apply" className="shrink-0 px-6" jobId={jobId} surface="mobile-bar" />
      </div>
    </MobileBarShell>
  )
}
