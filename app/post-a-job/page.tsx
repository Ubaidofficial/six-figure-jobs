import type { Metadata } from 'next'
import { ArrowRight, CalendarClock, Check, Mail, MousePointerClick, ShieldCheck, Target } from 'lucide-react'

import Link from '@/components/ui/Link'
import { loadPublicSiteStats } from '@/lib/jobs/publicStats'
import { loadSiteCounts } from '@/lib/jobs/siteCounts'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'
import { SPONSOR_SLOT_COUNT } from '@/lib/sponsors/slots'

import styles from './page.module.css'

const SITE_URL = getSiteUrl()
const CONTACT = 'support@6figjobs.com'

// The advertise page. Indexable and in the first sitemap wave since 2026-11-22 (owner's request: a business page a
// new site should have in search, like /about). It carries no hreflang. Linked from the header and footer.
export const metadata: Metadata = {
  title: `Advertise on ${SITE_NAME}`,
  description: 'Put your company in front of people searching for $100k+ jobs, with a clearly labelled sponsored placement.',
  alternates: { canonical: `${SITE_URL}/post-a-job` },
  robots: { index: true, follow: true },
}

// The live numbers come from the database; kept for ten minutes. If they cannot be read, the strip is left out.
export const revalidate = 600

const mailto = (subject: string, body: string) =>
  `mailto:${CONTACT}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`

const REQUEST_RATES = mailto(
  'Sponsored placement',
  [
    'Company or product:',
    'What you want to promote (and the link):',
    'Preferred dates:',
    '',
    'Please reply with availability and rates.',
  ].join('\n'),
)

async function loadStats(): Promise<{ jobs: number; companies: number; countries: number } | null> {
  try {
    const [stats, counts] = await Promise.all([loadPublicSiteStats(), loadSiteCounts()])
    return { jobs: stats.totalJobs, companies: stats.totalCompaniesHiring, countries: counts.byCountry.length }
  } catch {
    return null
  }
}

const n = (value: number) => value.toLocaleString('en-US')

const REASONS = [
  {
    icon: Target,
    title: 'A focused audience',
    text: 'Every job here shows a published salary of six figures or more, so the people reading are comparing high-paying roles, not browsing everything.',
  },
  {
    icon: ShieldCheck,
    title: 'Clearly labelled',
    text: 'Always marked "Sponsored", and the link is flagged as a paid link. It never changes how jobs are ordered and it is never presented as a job.',
  },
  {
    icon: MousePointerClick,
    title: 'Visits you can see',
    text: 'Your link is tagged, so the visits from us show up in your own analytics. You choose the page it points to.',
  },
  {
    icon: CalendarClock,
    title: 'No lock-in',
    text: 'We agree the dates up front. A placement ends on its last day by itself, so there is nothing to cancel and nothing to forget.',
  },
]

const STEPS = [
  { title: 'Tell us what to promote', text: 'Your company, product or hiring page, the link, and the dates you want.' },
  { title: 'We confirm availability and rate', text: 'We reply by email. Nothing is booked until we have agreed both.' },
  { title: 'Your card goes live', text: 'It shows above the job list on the home page and /jobs until its last day, then ends.' },
]

const FAQ = [
  {
    q: 'Who can advertise?',
    a: 'Anything useful to people looking for $100k+ jobs: a company’s hiring page, a developer tool, a career service. We may decline a placement that is misleading or unrelated.',
  },
  {
    q: 'How many placements are there?',
    a: `Only ${SPONSOR_SLOT_COUNT} at a time, so each one stays visible. Tell us your dates and we will say what is free.`,
  },
  {
    q: 'Does it change which jobs people see?',
    a: 'No. It does not change how jobs are ordered and it does not add a job to the listings. It is a separate card, always labelled "Sponsored".',
  },
  {
    q: 'How do I see the results?',
    a: 'We tag the link you give us, so visits from this site appear in your own analytics under their own source and campaign.',
  },
  {
    q: 'What does it cost?',
    a: 'It depends on the dates. Ask for rates and we will reply with availability and a price.',
  },
  {
    q: 'I want my jobs listed, not an ad.',
    a: 'That happens automatically and is free. We collect jobs from employers’ careers pages and the systems they post on, and list the ones that publish a salary at or above the six-figure floor for their currency.',
  },
]

export default async function PostAJobPage() {
  const stats = await loadStats()

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Advertise on {SITE_NAME}</p>
        <h1 className={styles.title}>
          Get in front of people searching for <span className={styles.accent}>$100k+ jobs</span>
        </h1>
        <p className={styles.lede}>
          A sponsored card above the job list puts your company, hiring page or product where high earners are already
          comparing roles.
        </p>
        <div className={styles.actions}>
          <a className={styles.primary} href={REQUEST_RATES}>
            <Mail aria-hidden="true" size={18} /> Request rates and availability
          </a>
          <a className={styles.secondary} href="#how-it-works">
            How it works <ArrowRight aria-hidden="true" size={16} />
          </a>
        </div>

        {stats ? (
          <ul className={styles.stats} aria-label="The site today">
            <li>
              <span className={styles.statNumber}>{n(stats.jobs)}</span>
              <span className={styles.statLabel}>live jobs with a published six-figure salary</span>
            </li>
            <li>
              <span className={styles.statNumber}>{n(stats.companies)}</span>
              <span className={styles.statLabel}>companies hiring now</span>
            </li>
            <li>
              <span className={styles.statNumber}>{n(stats.countries)}</span>
              <span className={styles.statLabel}>countries</span>
            </li>
          </ul>
        ) : null}
      </section>

      <section className={styles.section} aria-labelledby="why">
        <h2 id="why" className={styles.h2}>
          Why advertise here
        </h2>
        <div className={styles.cards}>
          {REASONS.map(({ icon: Icon, title, text }) => (
            <article key={title} className={styles.card}>
              <span className={styles.iconTile}>
                <Icon aria-hidden="true" size={20} />
              </span>
              <h3 className={styles.h3}>{title}</h3>
              <p className={styles.muted}>{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={`${styles.section} ${styles.split}`} aria-labelledby="what">
        <div>
          <h2 id="what" className={styles.h2}>
            What you get
          </h2>
          <ul className={styles.checks}>
            <li>
              <Check aria-hidden="true" size={18} /> A card with your name, logo and one line of text
            </li>
            <li>
              <Check aria-hidden="true" size={18} /> Shown above the job list on the home page and on /jobs
            </li>
            <li>
              <Check aria-hidden="true" size={18} /> A link to the page you choose, tagged for your analytics
            </li>
            <li>
              <Check aria-hidden="true" size={18} /> Only {SPONSOR_SLOT_COUNT} placements at a time
            </li>
            <li>
              <Check aria-hidden="true" size={18} /> Dates agreed up front, ending on their own
            </li>
          </ul>
        </div>

        <div className={styles.mock} aria-label="Example of a sponsored card">
          <p className={styles.mockLabel}>Sponsored · example</p>
          <div className={styles.mockCard}>
            <span className={styles.mockLogo} aria-hidden="true">
              Y
            </span>
            <span className={styles.mockText}>
              <span className={styles.mockName}>Your company</span>
              <span className={styles.mockBlurb}>One line about what you want people to know.</span>
            </span>
          </div>
        </div>
      </section>

      <section id="how-it-works" className={styles.section} aria-labelledby="how">
        <h2 id="how" className={styles.h2}>
          How it works
        </h2>
        <ol className={styles.steps}>
          {STEPS.map((step, i) => (
            <li key={step.title} className={styles.step}>
              <span className={styles.stepNumber}>{i + 1}</span>
              <h3 className={styles.h3}>{step.title}</h3>
              <p className={styles.muted}>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section} aria-labelledby="faq">
        <h2 id="faq" className={styles.h2}>
          Questions
        </h2>
        <div className={styles.faq}>
          {FAQ.map((item) => (
            <details key={item.q} className={styles.faqItem}>
              <summary className={styles.faqQ}>{item.q}</summary>
              <p className={styles.faqA}>{item.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={styles.band} aria-labelledby="cta">
        <h2 id="cta" className={styles.bandTitle}>
          Ready to reach high earners?
        </h2>
        <p className={styles.bandText}>
          Tell us who you are, what you want to promote and when. We reply with availability and a price. See also{' '}
          <Link className={styles.bandLink} href="/method">
            how the site works
          </Link>
          .
        </p>
        <a className={styles.primary} href={REQUEST_RATES}>
          <Mail aria-hidden="true" size={18} /> Request rates and availability
        </a>
      </section>
    </main>
  )
}
