import type { Metadata } from 'next'
import Link from '@/components/ui/Link'
import { SITE_NAME, getSiteUrl, defaultOgImages } from '@/lib/seo/site'
import {
  HIGH_SALARY_THRESHOLDS,
  TOP_OF_RANGE_CURRENCIES,
  TOP_OF_RANGE_MIN_SHARE,
  type HighSalaryCurrency,
} from '@/lib/currency/thresholds'
import { MAX_DISPLAY_AGE_DAYS } from '@/lib/ingest/jobAgeFilter'
import { formatCurrencyShort } from '@/lib/seo/salaryLabels'

const SITE_URL = getSiteUrl()
const TITLE = `How ${SITE_NAME} works: sources, salary rules and freshness`
const DESCRIPTION =
  'Where our $100k+ jobs come from, what counts as six figures in each currency, how salaries are checked, and how often listings are refreshed and removed.'

/** Market behind each currency in HIGH_SALARY_THRESHOLDS; the amounts are read from that file, never copied here. */
const MARKETS: Record<HighSalaryCurrency, string> = {
  USD: 'United States',
  GBP: 'United Kingdom',
  EUR: 'Eurozone',
  CAD: 'Canada',
  AUD: 'Australia',
  CHF: 'Switzerland',
  SGD: 'Singapore',
  NZD: 'New Zealand',
  NOK: 'Norway',
  SEK: 'Sweden',
  DKK: 'Denmark',
}

const euroThreshold = Number(HIGH_SALARY_THRESHOLDS.EUR)
const euroLowestBottom = Math.round(euroThreshold * TOP_OF_RANGE_MIN_SHARE)

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/method` },
  robots: { index: true, follow: true },
  openGraph: {
    images: defaultOgImages(),
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/method`,
    siteName: SITE_NAME,
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: TITLE, description: DESCRIPTION },
}

export default function MethodPage() {
  const webPageJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/method`,
    isPartOf: { '@type': 'WebSite', name: SITE_NAME, url: SITE_URL },
  }
  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE_URL },
      { '@type': 'ListItem', position: 2, name: 'How it works', item: `${SITE_URL}/method` },
    ],
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webPageJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }} />

      <h1 className="text-3xl font-semibold tracking-tight text-foreground">How {SITE_NAME} works</h1>
      <p className="mt-5 text-base leading-7 text-muted-foreground">
        Every number and listing on this site comes from the steps below. If something here does not match what you see
        on a page, tell us at{' '}
        <a className="text-primary underline" href="mailto:support@6figjobs.com">
          support@6figjobs.com
        </a>
        . For the short version, see <Link className="text-primary underline" href="/about">About</Link>.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">Where the jobs come from</h2>
      <p className="mt-4 text-muted-foreground">
        We read employers&apos; own careers pages and the applicant tracking systems they post on, such as Greenhouse,
        Lever, Ashby and Workday, and we also screen a large job catalogue (freehire) for roles that publish six-figure
        pay. Each apply button says where it goes, and you apply there, not through us.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">What counts as six figures</h2>
      <p className="mt-4 text-muted-foreground">
        A job needs a published salary, and &ldquo;six figures&rdquo; means a different amount in each currency, so each
        has its own yearly floor. Pay quoted per hour or per month is converted to a yearly figure.
      </p>
      <table className="mt-4 w-full max-w-md border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left text-foreground">
            <th className="py-2 pr-4 font-semibold">Market</th>
            <th className="py-2 font-semibold">Minimum yearly salary</th>
          </tr>
        </thead>
        <tbody className="text-muted-foreground">
          {(Object.keys(HIGH_SALARY_THRESHOLDS) as HighSalaryCurrency[]).map((currency) => (
            <tr key={currency} className="border-b border-border">
              <td className="py-2 pr-4">{MARKETS[currency] ?? currency}</td>
              <td className="py-2 font-mono">
                {formatCurrencyShort(Number(HIGH_SALARY_THRESHOLDS[currency]), currency)}+
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {TOP_OF_RANGE_CURRENCIES.has('EUR') ? (
        <p className="mt-4 text-muted-foreground">
          Euro jobs have one extra rule: European employers often publish a range rather than one figure, so a range
          whose top reaches {formatCurrencyShort(euroThreshold, 'EUR')} can qualify, as long as its bottom is at least{' '}
          {formatCurrencyShort(euroLowestBottom, 'EUR')}.
        </p>
      ) : null}

      <h2 className="mt-10 text-xl font-semibold text-foreground">How salaries are checked</h2>
      <p className="mt-4 text-muted-foreground">
        Salaries are read from the posting and checked automatically, and a job is listed only when its salary passes
        that check. We show the pay as the employer published it. We do not confirm what a company will actually pay.
      </p>

      <h2 className="mt-10 text-xl font-semibold text-foreground">What we leave out</h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>Jobs with no published salary.</li>
        <li>Internships, junior, entry-level and graduate roles, found by words in the title.</li>
        <li>Part-time, contract and temporary roles.</li>
        <li>
          Duplicates: when the same opening appears on an employer&apos;s own system and again on a job board, we keep
          one, preferring the copy that links to the employer.
        </li>
      </ul>

      <h2 className="mt-10 text-xl font-semibold text-foreground">How listings stay current</h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>Jobs are refreshed once a day.</li>
        <li>A job the employer has closed is removed, and so is any job we have not seen for 7 days.</li>
        <li>Nothing older than {MAX_DISPLAY_AGE_DAYS} days is shown, even if the posting is still up.</li>
        <li>
          The counts on our pages are taken from the live listings, not estimated. The time of the last refresh is shown
          on the <Link className="text-primary underline" href="/">home page</Link>.
        </li>
      </ul>

      <p className="mt-10 text-sm text-muted-foreground">Last updated: 2026-11-13</p>
    </main>
  )
}
