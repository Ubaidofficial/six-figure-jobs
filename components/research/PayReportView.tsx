// components/research/PayReportView.tsx
//
// The Six-Figure Job Pay Report, for one edition. Used by the permanent page (the latest edition) and by each dated page
// (/high-paying-jobs-report/<edition>). Every figure and sentence comes from the edition's data (lib/research/payReport.ts);
// nothing is typed into this file.
import type { ReactNode } from 'react'

import Link from '@/components/ui/Link'
import { Faq, ListingHeader, ListingPage } from '@/components/listing/ListingParts'
import { CopyField } from '@/components/research/CopyField'
import {
  MIN_CITY_EMPLOYERS,
  MIN_ROLE_LISTINGS,
  MIN_SAME_ROLE_LISTINGS,
  MIN_SKILL_LISTINGS,
  PAY_REPORT_EDITIONS,
  PAY_REPORT_HEADING,
  PAY_REPORT_PATH,
  REPORT_AUTHOR,
  REPORT_CONTACT,
  csvPath,
  diffPct,
  editionPath,
  isLatestEdition,
  payReportCitation,
  payReportDescription,
  payReportFaq,
  payReportFindings,
  payReportTrend,
  previousEdition,
  seniorityListings,
  usd,
  type PayReportData,
  type PayRow,
} from '@/lib/research/payReport'
import { PAY_REPORT_CHART_NAMES, chartEmbedHtml, chartPath, payReportChart } from '@/lib/research/payReportCharts'
import { SITE_NAME, getSiteUrl } from '@/lib/seo/site'

import styles from './PayReport.module.css'

const n = (v: number) => v.toLocaleString('en-US')
const longDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' })
const signed = (v: number) => `${v > 0 ? '+' : ''}${v.toFixed(1)}%`

type Column = { head: string; hideSm?: boolean }
type TableRow = { key: string; label: ReactNode; cells: ReactNode[]; barPct?: number }

/** A table whose last column carries a bar (zero-based, relative to the largest figure), so a table is also a chart. */
function DataTable({ caption, first, columns, rows }: { caption: string; first: string; columns: Column[]; rows: TableRow[] }) {
  const last = columns.length - 1
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{first}</th>
            {columns.map((c, i) => (
              <th key={c.head} scope="col" className={`${styles.num} ${c.hideSm ? styles.hideSm : ''} ${i === last ? styles.valueCol : ''}`}>
                {c.head}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <th scope="row">{row.label}</th>
              {row.cells.map((cell, i) => (
                <td key={columns[i].head} className={`${styles.num} ${columns[i].hideSm ? styles.hideSm : ''}`}>
                  {i === last && row.barPct !== undefined ? (
                    <span className={styles.valueCell}>
                      <span className={styles.bar} style={{ ['--r' as string]: row.barPct / 100 }} aria-hidden="true" />
                      <span className={styles.value}>{cell}</span>
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Rows for a list of PayRow: listings, (employers,) median with a bar. */
function payRows(list: PayRow[], withEmployers: boolean): { columns: Column[]; rows: TableRow[] } {
  const max = Math.max(...list.map((x) => x.median), 1)
  return {
    columns: [
      { head: 'Listings' },
      ...(withEmployers ? [{ head: 'Employers', hideSm: true }] : []),
      { head: 'Median advertised midpoint' },
    ],
    rows: list.map((x) => ({
      key: x.label,
      label: x.label,
      cells: [n(x.listings), ...(withEmployers ? [n(x.employers ?? 0)] : []), usd(x.median)],
      barPct: Math.round((100 * x.median) / max),
    })),
  }
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className={styles.section} aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className={styles.h2}>
        {title}
        <a href={`#${id}`} className={styles.anchor} aria-label={`Link to the section: ${title}`}>
          #
        </a>
      </h2>
      {children}
    </section>
  )
}

export function PayReportView({ report: r }: { report: PayReportData }) {
  const SITE_URL = getSiteUrl()
  const latest = isLatestEdition(r)
  const canonicalPath = latest ? PAY_REPORT_PATH : editionPath(r)
  const URL = `${SITE_URL}${canonicalPath}`
  const description = payReportDescription(r)
  const findings = payReportFindings(r)
  const faq = payReportFaq(r)
  const h = r.headline
  const trend = payReportTrend(r, previousEdition(r))
  const hybrid = r.arrangement.find((a) => a.label === 'Hybrid')
  const author = REPORT_AUTHOR
  const csv = csvPath(r)
  const heading = `${PAY_REPORT_HEADING}: ${r.month}`
  const seniorityTotal = seniorityListings(r)
  const above200 = Math.round((r.bands[2].pct + r.bands[3].pct) * 10) / 10

  const sections = [
    { id: 'findings', title: 'Key findings' },
    ...(trend.length > 0 ? [{ id: 'trend', title: 'Since the last edition' }] : []),
    { id: 'bands', title: 'Salary bands' },
    { id: 'seniority', title: 'Seniority' },
    { id: 'roles', title: 'Best-paid roles' },
    { id: 'arrangement', title: 'Remote, hybrid, on-site' },
    ...(r.rangeWidth ? [{ id: 'ranges', title: 'How wide the ranges are' }] : []),
    { id: 'cities', title: 'Cities' },
    ...(r.skills && r.skills.length > 0 ? [{ id: 'skills', title: 'Skills' }] : []),
    { id: 'employers', title: 'Who is hiring' },
    { id: 'highest', title: 'Highest ranges' },
    { id: 'method', title: 'Method and limits' },
    { id: 'cite', title: 'Cite, download, embed' },
    { id: 'about', title: 'About and corrections' },
    { id: 'faq', title: 'Questions' },
  ]

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Article',
      mainEntityOfPage: URL,
      headline: heading,
      description,
      url: URL,
      datePublished: r.publishedAt,
      dateModified: r.updatedAt,
      inLanguage: 'en',
      image: `${SITE_URL}/og-image.png`,
      author: author
        ? { '@type': 'Person', name: author.name, ...(author.url ? { url: author.url } : {}) }
        : { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: { '@type': 'ImageObject', url: `${SITE_URL}/logo.png` } },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Dataset',
      name: `${PAY_REPORT_HEADING}, ${r.month}: data`,
      description: `Advertised pay in ${n(h.allListings)} six-figure job listings (USD), by salary band, seniority, role, work arrangement, city and employer. Collected ${r.collected}.`,
      url: URL,
      datePublished: r.publishedAt,
      dateModified: r.updatedAt,
      inLanguage: 'en',
      isAccessibleForFree: true,
      creator: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
      measurementTechnique: 'Median of the midpoint of the advertised minimum and maximum salary in each job listing',
      distribution: [{ '@type': 'DataDownload', encodingFormat: 'text/csv', contentUrl: `${SITE_URL}${csv}` }],
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
        { '@type': 'ListItem', position: 3, name: PAY_REPORT_HEADING, item: URL },
      ],
    },
  ]

  return (
    <ListingPage>
      {jsonLd.map((block) => (
        <script key={block['@type']} type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(block) }} />
      ))}

      <ListingHeader
        breadcrumb={[{ label: 'Home', href: '/' }, { label: 'High-paying jobs', href: '/high-paying-jobs' }, { label: PAY_REPORT_HEADING }]}
        title={PAY_REPORT_HEADING}
        summary={
          <>
            What <strong>{n(h.listings)}</strong> six-figure job listings from <strong>{n(h.employers)}</strong> employers actually advertise.
            The median is <strong>{usd(h.medianMidpoint)}</strong>.
          </>
        }
      />

      <p className={styles.meta}>
        <span>
          <strong>{r.month}</strong> edition
        </span>
        <span>Data collected {r.collected}</span>
        <span>Updated {longDate(r.updatedAt)}</span>
        <span>
          Analysis by <strong>{author ? author.name : SITE_NAME}</strong>
          {author?.role ? `, ${author.role}` : ''}
        </span>
      </p>

      <div className={styles.actions}>
        <a className={styles.btn} href={csv} download>
          Download the data (CSV)
        </a>
        <a className={`${styles.btn} ${styles.btnQuiet}`} href="#cite">
          Cite or embed
        </a>
        <Link className={`${styles.btn} ${styles.btnQuiet}`} href="/method">
          How our data works
        </Link>
      </div>

      {!latest ? (
        <p className={styles.notice} role="note">
          This is the {r.month} edition, kept as published. For the latest figures see <Link href={PAY_REPORT_PATH}>the current report</Link>.
        </p>
      ) : null}

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>Median advertised midpoint</dt>
          <dd>{usd(h.medianMidpoint)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Median advertised minimum, the cautious reading</dt>
          <dd>{usd(h.medianMinimum)}</dd>
        </div>
        <div className={styles.stat}>
          <dt>Of listings advertise a midpoint of $200,000 or more</dt>
          <dd>{above200}%</dd>
        </div>
        <div className={styles.stat}>
          <dt>Of listings are remote</dt>
          <dd>{r.remoteSharePct}%</dd>
        </div>
      </dl>

      <div className={styles.layout}>
        <nav className={styles.toc} aria-label="On this page">
          <p className={styles.tocTitle}>On this page</p>
          <ol>
            {sections.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>{s.title}</a>
              </li>
            ))}
          </ol>
        </nav>

        <div className={styles.column}>
          <Section id="findings" title="Key findings">
            <p className={styles.callout} style={{ marginBottom: 14 }}>
              <strong>What this is, and is not.</strong> It describes the listings we collect that advertise $100,000 or more, in US
              dollars: advertised ranges, not what people are paid, and not the whole job market. See{' '}
              <a href="#method">method and limits</a>.
            </p>
            <ul className={styles.findings}>
              {findings.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Section>

          {trend.length > 0 ? (
            <Section id="trend" title="Since the last edition">
              {r.sinceLastEdition ? <p className={styles.lead}>{r.sinceLastEdition}</p> : null}
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <caption className="sr-only">Change in the headline figures since the previous edition</caption>
                  <thead>
                    <tr>
                      <th scope="col">Figure</th>
                      <th scope="col" className={styles.num}>Previous</th>
                      <th scope="col" className={styles.num}>This edition</th>
                      <th scope="col" className={styles.num}>Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trend.map((t) => (
                      <tr key={t.label}>
                        <th scope="row">{t.label}</th>
                        <td className={styles.num}>{t.kind === 'usd' ? usd(t.previous) : `${t.previous}%`}</td>
                        <td className={styles.num}>{t.kind === 'usd' ? usd(t.current) : `${t.current}%`}</td>
                        <td className={`${styles.num} ${t.changePct >= 0 ? styles.pos : styles.neg}`}>{signed(t.changePct)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          ) : null}

          <Section id="bands" title="Where six-figure listings sit by salary">
            <p className={styles.lead}>Share of the {n(h.allListings)} validated USD listings whose advertised midpoint falls in each band.</p>
            <DataTable
              caption="Listings by advertised salary band"
              first="Advertised midpoint"
              columns={[{ head: 'Listings', hideSm: false }, { head: 'Share' }]}
              rows={r.bands.map((b) => ({
                key: b.label,
                label: b.label,
                cells: [n(b.listings), `${b.pct.toFixed(1)}%`],
                barPct: Math.round((100 * b.pct) / Math.max(...r.bands.map((x) => x.pct))),
              }))}
            />
          </Section>

          <Section id="seniority" title="Pay by seniority">
            <p className={styles.lead}>
              Median advertised midpoint by the experience level stored for each listing. {n(seniorityTotal)} of the {n(h.allListings)} listings
              carry a level, so this table describes those, not all.
            </p>
            <DataTable
              caption="Median advertised midpoint by seniority"
              first="Level"
              {...payRows(r.seniority, false)}
            />
          </Section>

          <Section id="roles" title="The best-paid roles">
            <p className={styles.lead}>Roles with at least {MIN_ROLE_LISTINGS} listings, ranked by median advertised midpoint.</p>
            <DataTable caption="Roles ranked by median advertised midpoint" first="Role" {...payRows(r.roles, true)} />
            <p className={styles.after}>
              Roles with fewer listings can pay more, but a handful of postings cannot support a median, so we leave them out. For the live
              ranking of roles by pay, see <Link href="/high-paying-jobs">high-paying jobs ranked by real pay</Link>, or browse the{' '}
              <Link href="/salary">salary guides by role</Link>.
            </p>
          </Section>

          <Section id="arrangement" title="Remote, hybrid and on-site">
            <DataTable caption="Median advertised midpoint by work arrangement" first="Arrangement" {...payRows(r.arrangement, true)} />
            <p className={styles.after}>
              About one in five six-figure listings ({r.remoteSharePct}%) is remote. {hybrid ? `The hybrid figure is the highest but rests on only ${hybrid.employers} employers, so it says little about hybrid work in general. ` : ''}
              These all-listings medians mix roles and cities. See current <Link href="/remote">remote six-figure jobs</Link>.
            </p>
            {r.sameRole && r.sameRole.length > 0 ? (
              <>
                <p className={styles.lead} style={{ marginTop: 24 }}>
                  <strong>Like with like.</strong> The same roles, remote against on-site. Only roles with at least {MIN_SAME_ROLE_LISTINGS} listings on each side are shown.
                </p>
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <caption className="sr-only">Median advertised midpoint for the same role, remote and on-site</caption>
                    <thead>
                      <tr>
                        <th scope="col">Role</th>
                        <th scope="col" className={styles.num}>Remote</th>
                        <th scope="col" className={styles.num}>On-site</th>
                        <th scope="col" className={styles.num}>Remote vs on-site</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.sameRole.map((p) => {
                        const d = diffPct(p.remote.median, p.onsite.median)
                        return (
                          <tr key={p.label}>
                            <th scope="row">{p.label}</th>
                            <td className={styles.num}>
                              {usd(p.remote.median)} <small>({n(p.remote.listings)})</small>
                            </td>
                            <td className={styles.num}>
                              {usd(p.onsite.median)} <small>({n(p.onsite.listings)})</small>
                            </td>
                            <td className={`${styles.num} ${d >= 0 ? styles.pos : styles.neg}`}>{signed(d)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <p className={styles.after}>Figures in brackets are listings.</p>
              </>
            ) : null}
          </Section>

          {r.rangeWidth ? (
            <Section id="ranges" title="How wide the advertised ranges are">
              <p className={styles.lead}>
                Among the {n(r.rangeWidth.ranged)} listings that state both a minimum and a maximum, out of {n(r.rangeWidth.of)} validated USD listings.
              </p>
              <dl className={styles.mini}>
                <div className={styles.stat}>
                  <dt>Median gap between maximum and minimum</dt>
                  <dd>{usd(r.rangeWidth.medianWidthUsd)}</dd>
                </div>
                <div className={styles.stat}>
                  <dt>The same gap as a share of the minimum</dt>
                  <dd>{r.rangeWidth.medianWidthPct}%</dd>
                </div>
                <div className={styles.stat}>
                  <dt>Ranges whose maximum is at least 1.5 times the minimum</dt>
                  <dd>{r.rangeWidth.pctWiderThan50}%</dd>
                </div>
              </dl>
              <p className={styles.after}>
                A wide range means the minimum understates what the posting allows, and the midpoint is a convention, not a prediction of the offer.
              </p>
            </Section>
          ) : null}

          <Section id="cities" title="Which cities pay the most">
            <p className={styles.lead}>
              The {r.cities.length} cities with the highest medians among those with at least 8 listings from at least {MIN_CITY_EMPLOYERS} employers.
            </p>
            <DataTable caption="Cities ranked by median advertised midpoint" first="City" {...payRows(r.cities, true)} />
            <p className={styles.after}>
              All {r.cities.length} are in the {r.citiesRegion}. By country, {r.countries.usSharePct}% of the USD-priced listings are in the United States,
              with a median of {usd(r.countries.usMedian)}; Canada has a median of {usd(r.countries.canadaMedian)} across {n(r.countries.canadaListings)} listings.
              Other countries have too few USD-priced listings to compare reliably.
            </p>
          </Section>

          {r.skills && r.skills.length > 0 ? (
            <Section id="skills" title="Skills named in the listings">
              <p className={styles.lead}>
                Median advertised midpoint of listings that name each skill, with at least {MIN_SKILL_LISTINGS} listings. A listing counts once for each
                skill it names. This is an association, not a cause: skills cluster in senior and specialist roles, so a high median mostly reflects which
                roles use the skill.
              </p>
              <DataTable caption="Skills ranked by median advertised midpoint" first="Skill" {...payRows(r.skills, true)} />
            </Section>
          ) : null}

          <Section id="employers" title="Who is hiring">
            <p className={styles.lead}>
              The employers with the most six-figure listings, leaving out recruiting and staffing firms, with their median advertised midpoint.
            </p>
            <DataTable caption="Employers with the most six-figure listings" first="Employer" {...payRows(r.employers, false)} />
            <p className={styles.after}>
              The single largest employer accounts for {r.concentration.top1Pct}% of the listings, the top five for {r.concentration.top5Pct}% and the top
              twenty for {r.concentration.top20Pct}%. That concentration is why we also report the median with each employer (of those with three or more
              listings) counted once: {usd(h.medianOfEmployerMedians)}.
            </p>
          </Section>

          <Section id="highest" title="The highest advertised ranges">
            <p className={styles.lead}>{r.highestRanges}</p>
          </Section>

          <Section id="method" title="Method and limits">
            <ul className={styles.limits}>
              <li>
                <strong>What is counted:</strong> listings with a validated salary in US dollars and an annual figure below $600,000. Our database keeps only
                listings at or above $100,000. Figures at exactly $600,000 are treated as caps, not real values, and left out.
              </li>
              <li>
                <strong>The number:</strong> each listing&rsquo;s figure is the midpoint of its advertised minimum and maximum (or the single figure when only
                one is given). This describes advertised ranges, not salaries paid. The median of the advertised minimums ({usd(h.medianMinimum)}) is the more
                conservative reading.
              </li>
              <li>
                <strong>Six-figure only:</strong> we store only listings at or above $100,000, so nothing here describes lower-paid jobs, and the medians are
                not market-wide averages.
              </li>
              <li>
                <strong>Listings, not openings:</strong> a count is a posting we collected. One role advertised in several places, or one employer posting the
                same job more than once, can be counted more than once.
              </li>
              <li>
                <strong>Window:</strong> listings we collected between {r.collected} that were {r.window}.{' '}
                {r.sinceLastEdition ?? 'Several of our sources were added or expanded in this period, so this edition cannot show trends over time.'}
              </li>
              <li>
                <strong>Sources:</strong> company career pages and job boards, which lean towards technology employers. The figures reflect that mix, not every
                industry. How we collect, check and remove listings is on the <Link href="/method">method page</Link>.
              </li>
              <li>
                <strong>Counts:</strong> the headline figures use {n(h.listings)} listings from named employers. The band, seniority, role, work-arrangement and
                location tables use all {n(h.allListings)} validated listings, including {n(h.allListings - h.listings)} that arrive through job-board aggregators.
              </li>
              <li>
                <strong>Sample sizes:</strong> we show a role or city only when it has enough listings from enough employers, and we say how many.
              </li>
            </ul>
          </Section>

          <Section id="cite" title="Cite, download and embed">
            <p className={styles.lead}>
              Free to quote with a link back. Each edition keeps its own address, so a citation of the {r.month} edition always shows the figures it quoted.
            </p>
            <div className={styles.actions} style={{ marginTop: 0 }}>
              <a className={styles.btn} href={csv} download>
                Download the data (CSV)
              </a>
            </div>
            <CopyField label="Citation" value={payReportCitation(r)} rows={5} />
            <CopyField label="Link (HTML)" value={`<a href="${SITE_URL}${PAY_REPORT_PATH}">${PAY_REPORT_HEADING}, ${r.month}, ${SITE_NAME}</a>`} rows={3} />
            <div className={styles.embedGrid}>
              {PAY_REPORT_CHART_NAMES.map((name) => {
                const chart = payReportChart(r, name)
                return (
                  <div key={name} className={styles.embed}>
                    {/* A plain <img>: it is an image route served as-is, with its own size and caching. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={chartPath(r, name)} alt={chart.alt} width={1200} height={675} loading="lazy" />
                    <CopyField label={`Embed: ${chart.title}`} value={chartEmbedHtml(r, name, SITE_URL)} rows={7} />
                  </div>
                )
              })}
            </div>
          </Section>

          <Section id="about" title="About this report and corrections">
            <ul className={styles.limits}>
              <li>
                <strong>Published by:</strong> {author ? `${author.name}${author.role ? `, ${author.role}` : ''}, ` : ''}
                {SITE_NAME}. First published {longDate(PAY_REPORT_EDITIONS[PAY_REPORT_EDITIONS.length - 1].publishedAt)}; this edition {longDate(r.publishedAt)}.
              </li>
              <li>
                <strong>Corrections and questions:</strong> <a href={`mailto:${REPORT_CONTACT}?subject=${encodeURIComponent(`${PAY_REPORT_HEADING}, ${r.month}`)}`}>{REPORT_CONTACT}</a>.
                {r.corrections.length === 0
                  ? ' No corrections have been made to this edition so far.'
                  : ' Corrections made to this edition are listed below.'}
              </li>
              {r.corrections.map((c) => (
                <li key={c.date + c.text}>
                  <strong>{longDate(c.date)}:</strong> {c.text}
                </li>
              ))}
              <li>
                <strong>All editions:</strong>
                <ul className={styles.editions}>
                  {PAY_REPORT_EDITIONS.map((e) => (
                    <li key={e.slug}>
                      <Link href={isLatestEdition(e) ? PAY_REPORT_PATH : editionPath(e)}>{e.month}</Link>
                      {isLatestEdition(e) ? ' (latest)' : ''}
                      {e.slug === r.slug ? ' (this page)' : ''}
                    </li>
                  ))}
                </ul>
              </li>
            </ul>
          </Section>

          <Section id="faq" title="Questions about this report">
            <Faq items={faq} />
          </Section>
        </div>
      </div>
    </ListingPage>
  )
}
