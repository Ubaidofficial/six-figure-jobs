// app/high-paying-jobs-report/method/page.tsx
//
// The Six-Figure Job Pay Report's method, versioned: every rule the numbers depend on, the checks that come with an edition,
// a data dictionary for the report and its CSV, and the history of method changes. The rules are read from
// lib/research/method.ts, the same file the research query is built from, so this page cannot say something the query does
// not do. (The site-wide page on sources and freshness is /method.)
import type { Metadata } from 'next'

import { DataTable, Section } from '@/components/research/PayReportView'
import { ListingHeader, ListingPage } from '@/components/listing/ListingParts'
import Link from '@/components/ui/Link'
import {
  AGGREGATOR_PATTERNS,
  BAY_AREA_CITIES,
  DATA_DICTIONARY,
  METHOD_CHANGELOG,
  METHOD_PATH,
  METHOD_VERSION,
  MIN_CONFIDENCE,
  MIN_SAME_ROLE_EMPLOYERS,
  MIN_SKILL_EMPLOYERS,
  USD_CAP,
} from '@/lib/research/method'
import {
  MIN_CITY_EMPLOYERS,
  MIN_ROLE_LISTINGS,
  MIN_SAME_ROLE_LISTINGS,
  MIN_SKILL_LISTINGS,
  PAY_REPORT,
  PAY_REPORT_HEADING,
  PAY_REPORT_PATH,
  REPORT_CONTACT,
  usd,
} from '@/lib/research/payReport'
import { fitTitle } from '@/lib/seo/metaText'
import { SITE_NAME, defaultOgImages, getSiteUrl } from '@/lib/seo/site'

import styles from '@/components/research/PayReport.module.css'

const SITE_URL = getSiteUrl()
const URL = `${SITE_URL}${METHOD_PATH}`
const TITLE = fitTitle([
  `${PAY_REPORT_HEADING}: method and data dictionary | ${SITE_NAME}`,
  `${PAY_REPORT_HEADING}: method and data dictionary`,
  `${PAY_REPORT_HEADING} method`,
])
const DESCRIPTION =
  'How the Six-Figure Job Pay Report is built: what counts, the salary checks, sample floors, what is left out, a data dictionary and the history of method changes.'
const UPDATED = METHOD_CHANGELOG[0].date

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: {
    images: defaultOgImages(),
    title: `${PAY_REPORT_HEADING}: method and data dictionary`,
    description: DESCRIPTION,
    url: URL,
    siteName: SITE_NAME,
    type: 'article',
    modifiedTime: UPDATED,
  },
  twitter: { card: 'summary_large_image', title: `${PAY_REPORT_HEADING}: method and data dictionary`, description: DESCRIPTION },
}

export default function PayReportMethodPage() {
  const latest = PAY_REPORT
  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'TechArticle',
      mainEntityOfPage: URL,
      headline: `${PAY_REPORT_HEADING}: method and data dictionary (version ${METHOD_VERSION})`,
      description: DESCRIPTION,
      url: URL,
      dateModified: UPDATED,
      inLanguage: 'en',
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
      // The Dataset itself is marked up on the report page; a nested Dataset here counts as a second, incomplete one.
      about: { '@type': 'Report', name: PAY_REPORT_HEADING, url: `${SITE_URL}${PAY_REPORT_PATH}` },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: PAY_REPORT_HEADING, item: `${SITE_URL}${PAY_REPORT_PATH}` },
        { '@type': 'ListItem', position: 3, name: 'Method and data dictionary', item: URL },
      ],
    },
  ]

  return (
    <ListingPage>
      {jsonLd.map((block) => (
        <script key={block['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
      ))}

      <ListingHeader
        breadcrumb={[{ label: 'Home', href: '/' }, { label: PAY_REPORT_HEADING, href: PAY_REPORT_PATH }, { label: 'Method' }]}
        title="Pay report method"
        summary={
          <>
            Every rule behind the <Link href={PAY_REPORT_PATH}>{PAY_REPORT_HEADING}</Link>, so a figure can be checked and a different reading argued with. Method
            version <strong>{METHOD_VERSION}</strong>, last changed {new Date(UPDATED).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })}.
          </>
        }
      />

      <div className={styles.layout} style={{ gridTemplateColumns: 'minmax(0, 52rem)' }}>
        <div className={styles.column}>
          <Section id="measures" title="What the report measures">
            <p className={styles.lead}>
              The pay that job postings <strong>advertise</strong>, for the six-figure listings we collect: a salary of $100,000 or more a year, in US dollars. It
              does not measure what people are paid, and it says nothing about jobs that pay less, because we do not store them. Read each figure as &ldquo;what
              employers who publish a six-figure range are advertising&rdquo;.
            </p>
          </Section>

          <Section id="rules" title="The rules, in order">
            <ol className={`${styles.limits} ${styles.ordered}`}>
              <li>
                <strong>Window.</strong> Listings we collected {latest.collected} that were {latest.window}. A window is stated on every edition.
              </li>
              <li>
                <strong>Validated salary.</strong> The listing&rsquo;s salary must have passed our salary checks with a confidence of at least{' '}
                <strong>{MIN_CONFIDENCE}</strong> (out of 100), the same gate the salary guides use.
              </li>
              <li>
                <strong>US dollars only.</strong> Listings in other currencies are left out. We do not convert, so no exchange-rate guess enters a figure.
              </li>
              <li>
                <strong>Below the cap.</strong> The annual figure must be below <strong>{usd(USD_CAP)}</strong>. A figure at exactly {usd(USD_CAP)} is a clamp from
                parsing, not a real value, and is left out.
              </li>
              <li>
                <strong>The figure.</strong> The midpoint of the advertised minimum and maximum, or the single figure when a posting gives one. The median of the
                advertised minimums is shown beside it as the more cautious reading.
              </li>
              <li>
                <strong>The statistic.</strong> Medians, not averages, so a few very high ranges cannot pull a figure up. Where an edition shows the &ldquo;middle
                half&rdquo;, that is the 25th to the 75th percentile of the same figure. The report also gives the median of employer medians, counting each employer
                with three or more listings once.
              </li>
              <li>
                <strong>Employer tables.</strong> Job boards and aggregators list other employers&rsquo; jobs under their own name, so they are not employers. Names
                starting with {AGGREGATOR_PATTERNS.map((x) => x.replace('%', '')).join(', ')} are left out of employer rankings and employer counts. Recruiting and
                staffing firms are also left out of the employer table.
              </li>
              <li>
                <strong>Sample floors.</strong> A role needs at least {MIN_ROLE_LISTINGS} listings. A city needs at least 8 listings from at least {MIN_CITY_EMPLOYERS}{' '}
                employers. A same-role remote against on-site comparison needs at least {MIN_SAME_ROLE_LISTINGS} listings from {MIN_SAME_ROLE_EMPLOYERS} employers on each
                side. A skill needs at least {MIN_SKILL_LISTINGS} listings from {MIN_SKILL_EMPLOYERS} employers. Groups below a floor are left out, not shown with a warning.
              </li>
            </ol>
          </Section>

          <Section id="limits" title="What the figures cannot tell you">
            <ul className={styles.limits}>
              <li>
                <strong>Advertised, not paid.</strong> A range is an employer&rsquo;s statement, and the midpoint is a convention. Offers can land anywhere in or
                outside a range.
              </li>
              <li>
                <strong>Six figures only.</strong> We store listings at or above $100,000, so the report describes the top of the market, not the market.
              </li>
              <li>
                <strong>Listings, not openings.</strong> One role advertised in several places, or posted more than once, can be counted more than once. Each
                edition gives a one-listing-per-employer-and-title figure as a floor for this when its run has it.
              </li>
              <li>
                <strong>Who we collect from.</strong> Company career pages and job boards, which lean towards technology employers. A few large employers account for
                a large share of listings, and the report says how large.
              </li>
              <li>
                <strong>One window.</strong> An edition describes its window. Editions are comparable only when the method version and sources are, and each edition
                says whether they changed.
              </li>
            </ul>
          </Section>

          <Section id="checks" title="Checks that come with each edition">
            <ul className={styles.limits}>
              <li>
                <strong>What was counted.</strong> A funnel from every job stored in the window to those in the tables, so a reader sees what was dropped and why.
              </li>
              <li>
                <strong>Is the number robust?</strong> The headline median with the five largest employers taken out, with the Bay Area taken out (
                {BAY_AREA_CITIES.join(', ')}; a listing with no city is kept) and with one listing per employer and job title.
              </li>
              <li>
                <strong>Spot-check.</strong> A random sample of listings is compared by hand with their postings. The edition states the result only when the check was
                really done, with the date.
              </li>
              <li>
                <strong>Automated tests.</strong> They check that the salary bands add up to the listings, that every table is in the order its heading says, that the
                sample floors hold, and that the CSV matches the tables.
              </li>
              <li>
                <strong>Quoted evidence.</strong> The highest ranges are shown with the pay text exactly as the posting wrote it, the source and the day it was read.
              </li>
            </ul>
            <p className={styles.after}>
              A check appears on an edition only when its numbers exist. A missing check means it was not run for that edition, not that it passed.
            </p>
          </Section>

          <Section id="dictionary" title="Data dictionary">
            <DataTable
              caption="Terms and CSV columns"
              first="Term"
              columns={[{ head: 'Meaning', text: true }]}
              rows={DATA_DICTIONARY.map((d) => ({ key: d.term, label: d.term, cells: [d.meaning] }))}
            />
          </Section>

          <Section id="changes" title="History of method changes">
            <DataTable
              caption="Method versions"
              first="Version"
              columns={[{ head: 'Date' }, { head: 'Change', text: true }]}
              rows={METHOD_CHANGELOG.map((c) => ({ key: c.version, label: c.version, cells: [c.date, c.change] }))}
            />
          </Section>

          <Section id="reuse" title="Using and correcting the data">
            <p className={styles.lead}>
              Every table of an edition is in its CSV, linked from the <Link href={PAY_REPORT_PATH}>report</Link>. Quote the figures with a link back. If you find
              a mistake, or read a rule differently, write to <a href={`mailto:${REPORT_CONTACT}?subject=${encodeURIComponent('Pay report method')}`}>{REPORT_CONTACT}</a>:
              corrections are listed on the edition they affect. For how the site collects, checks and removes listings in general, see{' '}
              <Link href="/method">How {SITE_NAME} works</Link>.
            </p>
          </Section>
        </div>
      </div>
    </ListingPage>
  )
}
