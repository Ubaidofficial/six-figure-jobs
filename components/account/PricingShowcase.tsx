// The sales side of /pricing: a hero with the same live numbers as the homepage, three product images with what they show,
// a grid of the tools around the job list, and a closing call to action. Server components, no client JS.
//
// Rule for the copy: only what the code or the pages shown can back. Prices are never written here (Stripe supplies them in
// PlansView); numbers come from the loaders the homepage uses; the screenshots are of the live site (see CAPTION_DATE) and
// every point beside one is visible in it. Facts that depend on a switch (instant alerts) are left out when it is off.
import { Bell, Building2, FileText, Flag, Globe, Route } from 'lucide-react'
import Image from 'next/image'

import { SiteStatsStrip } from '@/components/home/SiteStatsStrip'
import Link from '@/components/ui/Link'
import { FREE_MAX_ALERTS_PER_EMAIL, PRO_MAX_ALERTS_PER_EMAIL } from '@/lib/alerts/config'
import { DIRECT_EMPLOYERS } from '@/lib/constants/directEmployers'
import type { FreehireCatalog } from '@/lib/jobs/freehireCatalog'

import styles from './PricingShowcase.module.css'

/** What SiteStatsStrip takes: the same numbers the homepage shows. */
export type PricingStats = {
  jobs: number
  companies: number
  newThisWeek: number
  countries: number | null
  catalog: FreehireCatalog | null
  refreshedAt: Date | null
}

/** When the screenshots in /public/images/pricing were taken. Retake them when the site changes enough to matter. */
export const CAPTION_DATE = '16 November 2026'

const n = (v: number) => v.toLocaleString('en-US')

export function PricingHero({ stats, instantAlerts }: { stats: PricingStats | null; instantAlerts: boolean }) {
  return (
    <header className={styles.hero}>
      <p className={`eyebrow-pill ${styles.eyebrow}`}>Plans</p>
      <h1 className={styles.title}>Six-figure jobs, with the pay on every listing</h1>
      <p className={styles.lede}>
        Browsing every job, its salary and its apply link is free.{' '}
        {instantAlerts
          ? 'Pro adds instant alerts, more saved searches and credits for the application kit.'
          : 'Pro adds more saved searches and credits for the application kit.'}
      </p>
      {stats ? (
        <SiteStatsStrip
          jobs={stats.jobs}
          companies={stats.companies}
          newThisWeek={stats.newThisWeek}
          countries={stats.countries}
          catalog={stats.catalog}
          refreshedAt={stats.refreshedAt}
          compact
        />
      ) : null}
    </header>
  )
}

type Row = {
  id: string
  kicker: string
  title: string
  body: string
  points: string[]
  image: { src: string; width: number; height: number; alt: string }
  link?: { href: string; label: string }
}

function rows(): Row[] {
  return [
    {
      id: 'pay',
      kicker: 'Pay on every listing',
      title: 'No salary guessing',
      body: 'Only jobs that publish a salary reaching six figures, or the equivalent in each market, are listed. Every listing shows its pay range, and every apply button says where it goes.',
      points: [
        'Salary bands, typical pay and the pay floor for each market',
        'Filter by remote, hybrid or on-site, and by minimum salary',
        'Quick links for visa sponsorship, no degree required and the 4-day week',
      ],
      image: {
        src: '/images/pricing/home-hero.webp',
        width: 1400,
        height: 662,
        alt: 'The Six Figure Jobs home page: a search box with role, location, work arrangement and minimum salary filters, beside a salary snapshot with jobs by salary band, the pay floor for each market and jobs by type.',
      },
    },
    {
      id: 'fresh',
      kicker: 'Fresh roles',
      title: 'New jobs through the day',
      body: `Roles from ${n(DIRECT_EMPLOYERS.length)} employers are read straight from their own careers systems, and job boards and hiring platforms add the rest.`,
      points: [
        'Every row shows the employer, the pay and how long ago the job was posted',
        'Pay is shown in the job\'s own currency, such as US, Canadian or Australian dollars',
        'The latest jobs come first, and the newest carry a NEW badge',
      ],
      image: {
        src: '/images/pricing/latest-jobs.webp',
        width: 1400,
        height: 610,
        alt: 'The Latest Six Figure Opportunities list: seven new jobs from employers such as Loom, PostHog and Sentry, each with its pay range in US, Canadian or Australian dollars.',
      },
    },
    {
      id: 'report',
      kicker: 'Pay data',
      title: 'A pay report you can cite',
      body: 'The Six-Figure Job Pay Report shows what listings advertise: medians, ranges, seniority, cities, and remote against on-site. The method is published and the data is free to download.',
      points: ['Download the data as a CSV', 'Cite it or embed it in your own page', 'Read exactly how every figure is worked out'],
      image: {
        src: '/images/pricing/pay-report.webp',
        width: 1400,
        height: 367,
        alt: 'The Six-Figure Job Pay Report: its headline, buttons to download the data, cite it and read the method, and four figures including the median advertised midpoint.',
      },
      link: { href: '/high-paying-jobs-report', label: 'Open the pay report' },
    },
  ]
}

export function PricingShowcase() {
  return (
    <section className={styles.showcase} aria-labelledby="showcase-title">
      <h2 id="showcase-title" className={styles.sectionTitle}>
        What the site gives you
      </h2>
      <p className={styles.sectionLede}>Screenshots of the live site, taken {CAPTION_DATE}. The figures in them move; the page you open will be current.</p>
      {rows().map((row) => (
        <article key={row.id} className={styles.row}>
          <div className={styles.copy}>
            <div className={styles.lead}>
              <p className={styles.kicker}>{row.kicker}</p>
              <h3 className={styles.rowTitle}>{row.title}</h3>
              <p className={styles.body}>{row.body}</p>
            </div>
            <div className={styles.aside}>
              <ul className={styles.points}>
                {row.points.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              {row.link ? (
                <Link href={row.link.href} className={styles.textLink}>
                  {row.link.label}
                </Link>
              ) : null}
            </div>
          </div>
          <figure className={styles.figure}>
            <div className={styles.frame}>
              <Image
                src={row.image.src}
                width={row.image.width}
                height={row.image.height}
                alt={row.image.alt}
                sizes="(min-width: 1100px) 1048px, 100vw"
                loading="lazy"
                className={styles.image}
              />
            </div>
          </figure>
        </article>
      ))}
      <p className={styles.honest}>
        Pay figures are advertised ranges, not what people are paid. Screened jobs are counted across the sources and platforms we read;
        listed jobs are counted from our own database.
      </p>
    </section>
  )
}

/** The tools around the list. Numbers are left out of a card when they could not be read. */
export function PricingFeatures({ stats, instantAlerts }: { stats: PricingStats | null; instantAlerts: boolean }) {
  const cards = [
    {
      icon: Bell,
      title: 'Email alerts',
      text: `Save a search and get a daily or weekly email. Free accounts can save ${FREE_MAX_ALERTS_PER_EMAIL}; Pro up to ${PRO_MAX_ALERTS_PER_EMAIL}.${
        instantAlerts ? ' Pro also gets instant alerts, within about 15 minutes of a job appearing.' : ''
      }`,
    },
    {
      icon: FileText,
      title: 'Application kit',
      text: 'A cover letter for each job you apply to, paid for with the credits that come with Pro.',
    },
    {
      icon: Building2,
      title: 'Company pages',
      text: stats
        ? `${n(stats.companies)} companies are hiring now, each with a page that lists its open six-figure roles.`
        : 'Each company that is hiring has a page that lists its open six-figure roles.',
    },
    {
      icon: Globe,
      title: 'Markets',
      text: stats?.countries
        ? `Jobs in ${n(stats.countries)} countries, with the pay floor set for each market.`
        : 'Jobs in many countries, with the pay floor set for each market.',
    },
    {
      icon: Flag,
      title: 'Spot a problem?',
      text: 'Every job page has a report link for a wrong salary, a dead link or a recruiter posting.',
    },
    {
      icon: Route,
      title: 'How it works',
      text: 'How millions of listings are screened down to the ones that publish six-figure pay.',
      href: '/method',
      label: 'Read how it works',
    },
  ]
  return (
    <section className={styles.features} aria-labelledby="features-title">
      <h2 id="features-title" className={styles.sectionTitle}>
        And the tools around it
      </h2>
      <ul className={styles.grid}>
        {cards.map((c) => (
          <li key={c.title} className={styles.card}>
            <span className={styles.icon} aria-hidden="true">
              <c.icon size={20} strokeWidth={1.75} />
            </span>
            <h3 className={styles.cardTitle}>{c.title}</h3>
            <p className={styles.cardText}>{c.text}</p>
            {'href' in c && c.href ? (
              <Link href={c.href} className={styles.textLink}>
                {c.label}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function PricingClosing() {
  return (
    <section className={styles.closing} aria-labelledby="closing-title">
      <h2 id="closing-title" className={styles.closingTitle}>
        Start with the jobs. They are free.
      </h2>
      <p className={styles.closingText}>You can browse every listing, its salary and its apply link without an account.</p>
      <div className={styles.closingActions}>
        <Link href="/jobs" className={styles.primaryCta}>
          Browse six-figure jobs
        </Link>
        <Link href="/method" className={styles.secondaryCta}>
          How it works
        </Link>
      </div>
    </section>
  )
}
