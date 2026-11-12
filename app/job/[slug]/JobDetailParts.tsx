// Building blocks for the job detail page. Server components on shadcn's Card/Badge/Separator, styled with
// the site's theme tokens. The page keeps rendering on the server; only the logo and save/share buttons hydrate.
import type { ReactNode } from 'react'
import NextLink from '@/components/ui/Link'
import { BadgeCheck, ExternalLink, Globe } from 'lucide-react'

import { CompanyLogo } from '@/components/companies/CompanyLogo'
import { CountryFlag } from '@/components/ui/CountryFlag'
import { Card } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import type { SalaryRank } from '@/lib/jobs/salaryRank'
import { groupDescription, type DescriptionSection } from '@/lib/jobs/descriptionStructure'
import type { ApplySurface } from '@/lib/analytics/applyClick'
import { JOB_LANGUAGE_NAMES, type JobLanguage } from '@/lib/jobs/language'
import { boardNameFor } from '@/lib/scrapers/utils/boardHosts'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'
import type { JobLocationView } from '@/lib/location/jobLocation'

import styles from './JobDetail.module.css'

import { JobActions } from './JobActions'
import { ApplyLink } from './ApplyLink'
import { ReportJob } from './ReportJob'
import { MobileBarShell } from './MobileBarShell'

type Fact = { label: string; value: ReactNode }

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
const placeLink = 'underline-offset-4 hover:underline'

/** The hero's location text with its flag. A single place links its city and country to their landing pages when given. */
export function JobLocationText({
  view,
  cityHref,
  countryHref,
}: {
  view: JobLocationView
  cityHref: string | null
  countryHref: string | null
}) {
  const flag = <CountryFlag code={view.countryCode} className="mr-1.5" />
  if (!view.city || !view.countryName) {
    return (
      <span>
        {flag}
        {view.text}
      </span>
    )
  }
  return (
    <span>
      {flag}
      {cityHref ? (
        <NextLink href={cityHref} className={placeLink}>
          {view.city}
        </NextLink>
      ) : (
        view.city
      )}
      {view.region ? `, ${view.region}` : null},{' '}
      {countryHref ? (
        <NextLink href={countryHref} className={placeLink}>
          {view.countryName}
        </NextLink>
      ) : (
        view.countryName
      )}
    </span>
  )
}

/**
 * Shown when the posting is not written in English. Postings stay in the employer's language (nothing is translated or
 * stored on our side); the link opens Google Translate on this same public page, in a new tab, so the whole page,
 * requirements included, can be read in English.
 */
export function TranslateNotice({ language, pageUrl }: { language: JobLanguage; pageUrl: string }) {
  const href = `https://translate.google.com/translate?sl=auto&tl=en&u=${encodeURIComponent(pageUrl)}`
  return (
    <p className={styles.translateNotice}>
      This job is posted in {JOB_LANGUAGE_NAMES[language]}.{' '}
      <a href={href} target="_blank" rel="noopener noreferrer nofollow" className={styles.translateLink}>
        Translate to English
      </a>
    </p>
  )
}

export function JobSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className={styles.sectionTitle}>{title}</h2>
      {children}
    </section>
  )
}

/**
 * The posting's description. When the posting has at least two of Description / Requirements / Benefits worth of text,
 * it is shown in those three labelled buckets (the layout job seekers know from other boards), the posting's own
 * headings kept as sub-headings; otherwise as its own sections in order. Either way a jump list leads the way, and
 * boilerplate (equal opportunity, privacy) is folded into a <details> so it does not sit between the reader and the
 * apply button. The text itself is already sanitized by the page.
 */
export function DescriptionSections({ sections }: { sections: DescriptionSection[] }) {
  const { groups, folded } = groupDescription(sections)
  const prose = (html: string) => (
    <div className={`prose max-w-none ${styles.richText}`} dangerouslySetInnerHTML={{ __html: html }} />
  )
  const foldedBlocks = folded.map((s) => (
    <details key={s.id} id={s.id} className={styles.foldedSection}>
      <summary>{s.title}</summary>
      {prose(s.html)}
    </details>
  ))

  if (groups.length > 0) {
    return (
      <div className="space-y-2">
        <nav aria-label="In this description" className={styles.jumpNav}>
          <ul>
            {groups.map((g) => (
              <li key={g.id}>
                <a href={`#${g.id}`}>{g.title}</a>
              </li>
            ))}
          </ul>
        </nav>
        {groups.map((g) => (
          <section key={g.id} id={g.id} aria-labelledby={`${g.id}-title`} className={styles.descSection}>
            <h3 id={`${g.id}-title`} className={styles.descHeading}>
              {g.title}
            </h3>
            {g.sections.map((s) => (
              <div key={s.id} id={s.id} className={styles.descSub}>
                {s.title !== 'Overview' && s.title.toLowerCase() !== g.title.toLowerCase() ? (
                  <h4 className={styles.descSubheading}>{s.title}</h4>
                ) : null}
                {prose(s.html)}
              </div>
            ))}
          </section>
        ))}
        {foldedBlocks}
      </div>
    )
  }

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
      {jumpable.map((s) => (
        <section key={s.id} id={s.id} aria-labelledby={`${s.id}-title`} className={styles.descSection}>
          <h3 id={`${s.id}-title`} className={styles.descHeading}>
            {s.title}
          </h3>
          {prose(s.html)}
        </section>
      ))}
      {foldedBlocks}
    </div>
  )
}

// Say where the apply button goes. About half of the jobs sampled on 2026-11-08 apply through a job board (XING,
// Adzuna, Himalayas...), not on the employer's site, while every button said "Apply on company site".
function applyLabel(href: string): string {
  const board = boardNameFor(href)
  return board ? `Apply on ${board}` : 'Apply on company site'
}

function applyNote(href: string, companyName: string): string {
  const board = boardNameFor(href)
  return board
    ? `Opens ${companyName}\u2019s listing on ${board} in a new tab.`
    : `Opens ${companyName}\u2019s own application page in a new tab.`
}

/** Apply button after the description: the reader who has just finished it should not have to scroll back up. */
export function DescriptionApply({ applyHref, companyName, jobId }: { applyHref: string | null; companyName: string; jobId: string }) {
  if (!applyHref) return null
  return (
    <div className={styles.descApply}>
      <ApplyButton href={applyHref} label={applyLabel(applyHref)} jobId={jobId} surface="description-end" />
      <p>{applyNote(applyHref, companyName)}</p>
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
          <ApplyButton href={applyHref} label={applyLabel(applyHref)} className="mt-4 w-full" jobId={jobId} surface="apply-card" />
          <p className="mt-2 text-xs text-muted-foreground">
            {applyNote(applyHref, companyName)} We only count that the button was clicked (no cookies, nothing about you).
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
/** Where `value` sits between `lo` and `hi`, as a percent clamped to the track. */
function trackPos(value: number, lo: number, hi: number): number {
  return Math.min(100, Math.max(0, ((value - lo) / (hi - lo)) * 100))
}

export function PayCard({
  salaryText,
  salaryIsFromEmployer,
  rank,
  roleLabel,
  currency,
  jobMin,
  jobMax,
  applyHref,
  jobId,
}: {
  salaryText: string | null
  salaryIsFromEmployer: boolean
  rank: SalaryRank | null
  /** Who the rank is among: "software engineer", or "six-figure" when it is every listing. */
  roleLabel: string | null
  currency: string | null
  /** This job's own annual range (one end may be missing), drawn on the bar against the peers. */
  jobMin: number | null
  jobMax: number | null
  applyHref: string | null
  jobId: string
}) {
  const lowEnd = jobMin ?? jobMax
  const highEnd = jobMax ?? jobMin
  // The bar runs from the 5th to the 95th percentile of comparable listings, widened to include this job's range.
  const chart =
    rank && currency && lowEnd != null && highEnd != null
      ? (() => {
          const lo = Math.floor(Math.min(rank.p5, lowEnd) / 10_000) * 10_000
          const hi = Math.ceil(Math.max(rank.p95, highEnd) / 10_000) * 10_000
          if (hi <= lo) return null
          const f = (n: number) => formatCurrencyShort(Math.round(n / 1000) * 1000, currency)
          return {
            lo,
            hi,
            f,
            middleLeft: trackPos(rank.p25, lo, hi),
            middleWidth: trackPos(rank.p75, lo, hi) - trackPos(rank.p25, lo, hi),
            median: trackPos(rank.median, lo, hi),
            jobLeft: trackPos(lowEnd, lo, hi),
            jobWidth: Math.max(1.5, trackPos(highEnd, lo, hi) - trackPos(lowEnd, lo, hi)),
          }
        })()
      : null
  const peersLabel = roleLabel === 'six-figure' ? 'six-figure listings' : 'this role'

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
          {chart ? (
            <>
              <div
                className={styles.rangeTrack}
                role="img"
                aria-label={`This job pays ${chart.f(lowEnd!)} to ${chart.f(highEnd!)}. Most ${peersLabel} pay ${chart.f(rank.p25)} to ${chart.f(rank.p75)}; typical ${chart.f(rank.median)}.`}
              >
                <span className={styles.rangeMiddle} style={{ left: `${chart.middleLeft}%`, width: `${chart.middleWidth}%` }} />
                <span className={styles.rangeMedian} style={{ left: `${chart.median}%` }} />
                <span className={styles.rangeJob} style={{ left: `${chart.jobLeft}%`, width: `${chart.jobWidth}%` }} />
              </div>
              <div className={styles.rangeScale} aria-hidden="true">
                <span>{chart.f(chart.lo)}</span>
                <span>{chart.f(chart.hi)}</span>
              </div>
              <dl className={styles.rangeLegend}>
                <div>
                  <dt>
                    <span className={styles.keyJob} aria-hidden="true" />
                    This job
                  </dt>
                  <dd>{lowEnd === highEnd ? chart.f(lowEnd!) : `${chart.f(lowEnd!)}\u2013${chart.f(highEnd!)}`}</dd>
                </div>
                <div>
                  <dt>
                    <span className={styles.keyMedian} aria-hidden="true" />
                    Typical
                  </dt>
                  <dd>{chart.f(rank.median)}</dd>
                </div>
                <div>
                  <dt>
                    <span className={styles.keyMiddle} aria-hidden="true" />
                    Most pay
                  </dt>
                  <dd>
                    {chart.f(rank.p25)}
                    {'\u2013'}
                    {chart.f(rank.p75)}
                  </dd>
                </div>
              </dl>
            </>
          ) : (
            <p className={styles.insightNote}>
              Typical for {peersLabel}: {formatCurrencyShort(Math.round(rank.median / 1000) * 1000, currency)}
            </p>
          )}
        </div>
      ) : null}

      {applyHref ? (
        <ApplyButton href={applyHref} label={applyLabel(applyHref)} className="mt-5 w-full" jobId={jobId} surface="hero" />
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
