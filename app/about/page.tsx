import type { Metadata } from 'next'
import Link from 'next/link'
import { SITE_NAME, getSiteUrl, defaultOgImages } from '@/lib/seo/site'
import { HIGH_SALARY_THRESHOLDS } from '@/lib/currency/thresholds'
import { MAX_DISPLAY_AGE_DAYS } from '@/lib/ingest/jobAgeFilter'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

const SITE_URL = getSiteUrl()

/** Rows of the "What counts as $100k+" table, read from the same thresholds the listings are filtered with. */
const SALARY_FLOOR_ROWS = [
  ['United States', 'USD'],
  ['United Kingdom', 'GBP'],
  ['Eurozone', 'EUR'],
  ['Canada', 'CAD'],
  ['Australia', 'AUD'],
  ['Switzerland', 'CHF'],
  ['Singapore', 'SGD'],
] as const

export const metadata: Metadata = {
  title: `About ${SITE_NAME}`,
  description:
    'Six Figure Jobs is a curated job board for $100k+ roles across remote, hybrid, and on-site opportunities worldwide.',
  alternates: {
    canonical: `${SITE_URL}/about`,
  },
  openGraph: { images: defaultOgImages(),
    title: `About ${SITE_NAME}`,
    description:
      'Learn how Six Figure Jobs curates $100k+ roles, salary-first discovery pages, and direct-apply job listings.',
    url: `${SITE_URL}/about`,
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: `About ${SITE_NAME}`,
    description:
      'Learn how Six Figure Jobs curates $100k+ roles, salary-first discovery pages, and direct-apply job listings.',
    images: [`${SITE_URL}/og-image.png`],
  },
}

export default function AboutPage() {
  const aboutPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    name: `About ${SITE_NAME}`,
    description:
      'Learn how Six Figure Jobs curates $100k+ roles, salary-first discovery pages, and direct-apply job listings.',
    url: `${SITE_URL}/about`,
    isPartOf: {
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
    },
  }
  const organizationJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.png`,
    email: 'support@6figjobs.com',
    sameAs: [
      'https://linkedin.com/company/sixfigjobs',
      'https://twitter.com/6figjobs',
    ],
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'About', item: `${SITE_URL}/about` },
    ],
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(aboutPageJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        About Six Figure Jobs
      </h1>

      <p className="mt-5 text-base leading-7 text-muted-foreground">
        Six Figure Jobs helps job seekers find high-paying roles faster.
        We focus on verified <strong>$100k+</strong> roles with strong salary
        signals across <strong>remote</strong>, <strong>hybrid</strong>, and{' '}
        <strong>on-site</strong> work.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        What makes us different
      </h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>
          <strong>Source-linked listings:</strong> we link to the original job
          post so you can apply direct.
        </li>
        <li>
          <strong>Salary-first discovery:</strong> browse by role, location, and
          pay bands.
        </li>
        <li>
          <strong>Global coverage:</strong> not just the US—EU and other regions
          are included when companies publish salary ranges.
        </li>
        <li>
          <strong>No index bloat:</strong> we avoid creating low-value pages that
          clutter search results.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">
        For job seekers
      </h2>
      <p className="mt-4 text-muted-foreground">
        Start here: <Link className="text-primary underline" href="/jobs">browse $100k+ jobs</Link>{' '}
        or explore <Link className="text-primary underline" href="/remote">remote roles</Link>.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">Where the listings come from</h2>
      <p className="mt-4 text-muted-foreground">
        Jobs are collected every day from employers&apos; career sites, the applicant tracking systems they post on, and
        the job boards where they advertise. Each apply button says where it goes, the employer&apos;s own application
        page or the job board the role was posted on, and you apply there, not through us. We keep only roles that publish a salary, and we show the pay range exactly as the employer gives it,
        converted to a yearly figure when it is quoted per hour or per month.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">What counts as $100k+</h2>
      <p className="mt-4 text-muted-foreground">
        &ldquo;Six figures&rdquo; means different things in different currencies, so each market has its own floor. A
        job is listed when the top of its published salary range reaches the floor for its currency:
      </p>
      <table className="mt-4 w-full max-w-md border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-foreground">
            <th className="py-2 pr-4 font-semibold">Market</th>
            <th className="py-2 font-semibold">Minimum yearly salary</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {SALARY_FLOOR_ROWS.map(([market, currency]) => (
            <tr key={currency} className="border-b border-border">
              <td className="py-2 pr-4">{market}</td>
              <td className="py-2 font-mono">{formatCurrencyShort(Number(HIGH_SALARY_THRESHOLDS[currency]), currency)}+</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2 className="mt-10 text-xl font-semibold text-foreground">How listings stay current</h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>New and updated jobs are pulled in once a day.</li>
        <li>A job the employer has closed is removed, and so is any job not seen in the last 7 days.</li>
        <li>Nothing older than {MAX_DISPLAY_AGE_DAYS} days is shown, even if the posting is still up.</li>
        <li>
          The counts on our pages (jobs, companies, salary bands) are taken from these live listings, not estimates.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">Contact</h2>
      <p className="mt-4 text-muted-foreground">
        For support or feedback, reach us at{' '}
        <a className="text-primary underline" href="mailto:support@6figjobs.com">
          support@6figjobs.com
        </a>
        .
      </p>

      <p className="mt-10 text-sm text-muted-foreground">Last updated: 2026-11-08</p>
    </main>
  )
}
