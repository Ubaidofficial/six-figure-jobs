// app/high-paying-jobs-report/page.tsx
//
// The monthly Six-Figure Job Pay Report: advertised pay in the six-figure listings we collect, by band, seniority, role,
// work arrangement, city and employer, with the method and its limits. One permanent URL, refreshed each month (see
// lib/research/payReport.ts), so the links it earns build up on one page. It is research, not a listing page: the head
// search "high paying jobs" belongs to /high-paying-jobs, which this page links to and does not compete with.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'

import Link from '@/components/ui/Link'
import { Faq, LinkChips, ListingHeader, ListingPage, ListingSection, Prose } from '@/components/listing/ListingParts'
import {
  MIN_CITY_EMPLOYERS,
  MIN_ROLE_LISTINGS,
  PAY_REPORT as R,
  PAY_REPORT_HEADING as HEADING,
  payReportDescription,
  payReportFaq,
  payReportFindings,
  payReportTitle,
  usd,
} from '@/lib/research/payReport'
import { keywordsFor } from '@/lib/seo/keywordMap'
import { SITE_NAME, defaultOgImages, getSiteUrl } from '@/lib/seo/site'

const SITE_URL = getSiteUrl()
const URL = `${SITE_URL}${R.path}`
const DESCRIPTION = payReportDescription()

export const metadata: Metadata = {
  title: payReportTitle(),
  description: DESCRIPTION,
  keywords: keywordsFor('payReport'),
  alternates: { canonical: URL },
  robots: { index: true, follow: true },
  openGraph: {
    images: defaultOgImages(),
    title: `${HEADING}: ${R.month}`,
    description: DESCRIPTION,
    url: URL,
    siteName: SITE_NAME,
    type: 'article',
    publishedTime: R.publishedAt,
    modifiedTime: R.updatedAt,
  },
  twitter: { card: 'summary_large_image', title: `${HEADING}: ${R.month}`, description: DESCRIPTION },
}

type Cell = ReactNode

function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: Cell[][] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h, i) => (
              <th key={h} scope="col" className={`px-4 py-3 font-medium ${i === 0 ? '' : 'text-right'}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={String(row[0])} className="border-b border-border last:border-0">
              {row.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="px-4 py-3 font-medium text-foreground">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="px-4 py-3 text-right text-muted-foreground">
                    {cell}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const n = (v: number) => v.toLocaleString('en-US')

export default function PayReportPage() {
  const findings = payReportFindings()
  const faq = payReportFaq()
  const h = R.headline

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: URL,
      headline: `${HEADING}: ${R.month}`,
      description: DESCRIPTION,
      url: URL,
      datePublished: R.publishedAt,
      dateModified: R.updatedAt,
      inLanguage: 'en',
      image: `${SITE_URL}/og-image.png`,
      author: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faq.map((q) => ({ '@type': 'Question', name: q.question, acceptedAnswer: { '@type': 'Answer', text: q.answer } })),
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'High-paying jobs', item: `${SITE_URL}/high-paying-jobs` },
        { '@type': 'ListItem', position: 3, name: HEADING, item: URL },
      ],
    },
  ]

  return (
    <ListingPage>
      {jsonLd.map((block) => (
        <script key={block['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
      ))}

      <ListingHeader
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'High-paying jobs', href: '/high-paying-jobs' }, { label: HEADING }]}
        title={HEADING}
        summary={
          <>
            Advertised pay in <strong>{n(h.listings)}</strong> six-figure job listings from <strong>{n(h.employers)}</strong>{' '}
            employers: the median is <strong>{usd(h.medianMidpoint)}</strong>. {R.month} edition, refreshed monthly.
          </>
        }
      />

      <ListingSection title="Read this first">
        <Prose>
          <p>
            The data covers listings that advertise a salary of $100,000 or more, in US dollars. It describes six-figure
            listings, not the whole job market, and it shows advertised ranges, not what people are paid. The limits are
            listed at the end so you can judge how far to trust each figure.
          </p>
        </Prose>
      </ListingSection>

      <ListingSection title="Key findings">
        <Prose>
          <ul>
            {findings.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
        </Prose>
      </ListingSection>

      <ListingSection title="Where six-figure listings sit by salary">
        <Prose>
          <p>Share of the {n(h.allListings)} validated USD listings whose advertised midpoint falls in each band.</p>
        </Prose>
        <DataTable
          caption="Listings by advertised salary band"
          head={['Advertised midpoint', 'Listings', 'Share']}
          rows={R.bands.map((b) => [b.label, n(b.listings), `${b.pct.toFixed(1)}%`])}
        />
      </ListingSection>

      <ListingSection title="Pay by seniority">
        <Prose>
          <p>Median advertised midpoint by the experience level stored for each listing (stored for about 8,300 of the listings).</p>
        </Prose>
        <DataTable
          caption="Median advertised midpoint by seniority"
          head={['Level', 'Listings', 'Median advertised midpoint']}
          rows={R.seniority.map((s) => [s.label, n(s.listings), usd(s.median)])}
        />
      </ListingSection>

      <ListingSection title="The best-paid roles">
        <Prose>
          <p>Roles with at least {MIN_ROLE_LISTINGS} listings, ranked by median advertised midpoint.</p>
        </Prose>
        <DataTable
          caption="Roles ranked by median advertised midpoint"
          head={['Role', 'Listings', 'Employers', 'Median advertised midpoint']}
          rows={R.roles.map((r) => [r.label, n(r.listings), n(r.employers ?? 0), usd(r.median)])}
        />
        <Prose>
          <p>
            Roles with fewer listings can pay more, but a handful of postings cannot support a median, so we leave them out. For
            the live ranking of roles by pay, see <Link href="/high-paying-jobs">high-paying jobs ranked by real pay</Link>, or
            browse the <Link href="/salary">salary guides by role</Link>.
          </p>
        </Prose>
      </ListingSection>

      <ListingSection title="Remote, hybrid and on-site">
        <DataTable
          caption="Median advertised midpoint by work arrangement"
          head={['Arrangement', 'Listings', 'Employers', 'Median advertised midpoint']}
          rows={R.arrangement.map((a) => [a.label, n(a.listings), n(a.employers ?? 0), usd(a.median)])}
        />
        <Prose>
          <p>
            About one in five six-figure listings ({R.remoteSharePct}%) is remote. The hybrid figure is the highest but rests on only{' '}
            {R.arrangement.find((a) => a.label === 'Hybrid')?.employers} employers, so it says little about hybrid work in general.
            See current <Link href="/remote">remote six-figure jobs</Link>.
          </p>
        </Prose>
      </ListingSection>

      <ListingSection title="Which cities pay the most">
        <Prose>
          <p>
            The {R.cities.length} cities with the highest medians among those with at least 8 listings from at least{' '}
            {MIN_CITY_EMPLOYERS} employers.
          </p>
        </Prose>
        <DataTable
          caption="Cities ranked by median advertised midpoint"
          head={['City', 'Listings', 'Employers', 'Median advertised midpoint']}
          rows={R.cities.map((c) => [c.label, n(c.listings), n(c.employers ?? 0), usd(c.median)])}
        />
        <Prose>
          <p>
            All {R.cities.length} are in the {R.citiesRegion}. By country, {R.countries.usSharePct}% of the USD-priced listings are
            in the United States, with a median of {usd(R.countries.usMedian)}; Canada has a median of{' '}
            {usd(R.countries.canadaMedian)} across {n(R.countries.canadaListings)} listings. Other countries have too few USD-priced
            listings to compare reliably.
          </p>
        </Prose>
      </ListingSection>

      <ListingSection title="Who is hiring">
        <Prose>
          <p>The employers with the most six-figure listings, leaving out recruiting and staffing firms, with their median advertised midpoint.</p>
        </Prose>
        <DataTable
          caption="Employers with the most six-figure listings"
          head={['Employer', 'Listings', 'Median advertised midpoint']}
          rows={R.employers.map((e) => [e.label, n(e.listings), usd(e.median)])}
        />
        <Prose>
          <p>
            The single largest employer accounts for {R.concentration.top1Pct}% of the listings, the top five for{' '}
            {R.concentration.top5Pct}% and the top twenty for {R.concentration.top20Pct}%. That concentration is why we also report
            the median with each employer (of those with three or more listings) counted once: {usd(h.medianOfEmployerMedians)}.
          </p>
        </Prose>
      </ListingSection>

      <ListingSection title="The highest advertised ranges">
        <Prose>
          <p>{R.highestRanges}</p>
        </Prose>
      </ListingSection>

      <ListingSection title="Method and limits">
        <Prose>
          <ul>
            <li>
              <strong>What is counted:</strong> listings with a validated salary in US dollars and an annual figure below $600,000.
              Our database keeps only listings at or above $100,000. Figures at exactly $600,000 are treated as caps, not real
              values, and left out.
            </li>
            <li>
              <strong>The number:</strong> each listing&rsquo;s figure is the midpoint of its advertised minimum and maximum (or the
              single figure when only one is given). This describes advertised ranges, not salaries paid. The median of the
              advertised minimums ({usd(h.medianMinimum)}) is the more conservative reading.
            </li>
            <li>
              <strong>Six-figure only:</strong> we store only listings at or above $100,000, so nothing here describes lower-paid
              jobs, and the medians are not market-wide averages.
            </li>
            <li>
              <strong>Window:</strong> listings we collected between {R.collected} that were {R.window}. Several of our sources
              were added or expanded in this period, so this edition cannot show trends over time.
            </li>
            <li>
              <strong>Sources:</strong> company career pages and job boards, which lean towards technology employers. The figures
              reflect that mix, not every industry.
            </li>
            <li>
              <strong>Counts:</strong> the headline figures use {n(h.listings)} listings from named employers. The band, seniority,
              role, work-arrangement and location tables use all {n(h.allListings)} validated listings, including{' '}
              {n(h.allListings - h.listings)} that arrive through job-board aggregators.
            </li>
            <li>
              <strong>Sample sizes:</strong> we show a role or city only when it has enough listings from enough employers, and we
              say how many.
            </li>
          </ul>
        </Prose>
      </ListingSection>

      <ListingSection title="Cite this report">
        <Prose>
          <p>
            Quoting these figures? Please link to this page. Suggested citation: {SITE_NAME}, &ldquo;{HEADING}, {R.month}&rdquo;,{' '}
            {URL}. This page keeps the same address each month and always shows the latest edition.
          </p>
        </Prose>
      </ListingSection>

      <ListingSection title="Questions about this report">
        <Faq items={faq} />
        <LinkChips
          label="Related"
          items={[
            { label: 'High-paying jobs ranked by pay', href: '/high-paying-jobs' },
            { label: 'Salary guides by role', href: '/salary' },
            { label: 'Remote $100k+ jobs', href: '/remote' },
            { label: 'Browse six-figure jobs', href: '/jobs' },
          ]}
        />
      </ListingSection>
    </ListingPage>
  )
}
