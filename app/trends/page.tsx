// app/trends/page.tsx
//
// "Six-figure job market trends": what is being hired for right now, from the jobs we already list. Open jobs, remote share, the
// last 7 days against the 7 before and the middle advertised pay, by area, country and employer; the weekly pay snapshot once
// there are two or more; and the roles people apply to most, once enough clicks have been counted. Everything comes from
// lib/trends/marketTrends.ts. These are OUR listings (every job states $100k+ pay), so no figure here is pay in general.
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { unstable_rethrow } from 'next/navigation'

import Link from '@/components/ui/Link'
import { ListingHeader, ListingPage, ListingSection, Prose } from '@/components/listing/ListingParts'
import { MIN_DEMAND_CLICKS, loadMarketTrends, loadPayWeeks, loadRoleDemand, type TrendCell } from '@/lib/trends/marketTrends'
import { buildRuntimeFallbackMetadata, logRuntimeFallback, skipPrerenderWhileBuilding } from '@/lib/runtime/fallback'
import { roleLabelFor } from '@/lib/roles/relatedRoles'
import { countryCodeToName, countryCodeToSlug } from '@/lib/seo/countrySlug'
import { buildDescription, fitTitle, titleDateTag, updatedLine } from '@/lib/seo/metaText'
import { SITE_NAME, defaultOgImages, getSiteUrl } from '@/lib/seo/site'

export const revalidate = 1800

const SITE_URL = getSiteUrl()
const PATH = '/trends'
const HEADING = 'Six-figure job market trends'
/** Fewer open jobs than this and the page is thin: it stays out of the index. */
const MIN_JOBS_TO_INDEX = 50

const n = (v: number) => v.toLocaleString('en-US')
const money = (v: number) => `$${Math.round(v / 1000)}k`
const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((100 * part) / whole)}%` : '–')
const pay = (c: TrendCell) => (c.medianUsd != null ? money(c.medianUsd) : '–')
// Our own name list lacks some countries (it returns the code for them, e.g. IN), so fall back to the platform's.
const regionNames = new Intl.DisplayNames(['en'], { type: 'region' })
const countryName = (code: string) => {
  const own = countryCodeToName(code)
  if (own !== code.toUpperCase()) return own
  try {
    return regionNames.of(code.toUpperCase()) ?? own
  } catch {
    return own
  }
}
const dateLabel = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { overall } = await loadMarketTrends()
    const title = fitTitle([
      `Six-Figure Job Market Trends ${titleDateTag()} | ${SITE_NAME}`,
      `Six-Figure Job Market Trends ${titleDateTag()}`,
      'Six-Figure Job Market Trends',
    ])
    const description = buildDescription(
      'What is being hired for at $100k+: open jobs, remote share and median pay by area, country and employer.',
      [[`${n(overall.open)} open jobs, ${share(overall.remote, overall.open)} remote.`], [`${n(overall.newThisWeek)} posted in the last 7 days.`]],
      updatedLine(),
    )
    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}${PATH}` },
      robots: overall.open >= MIN_JOBS_TO_INDEX ? { index: true, follow: true } : { index: false, follow: true },
      openGraph: { images: defaultOgImages(), title, description, url: `${SITE_URL}${PATH}`, siteName: SITE_NAME, type: 'website' },
      twitter: { card: 'summary_large_image', title, description },
    }
  } catch {
    return buildRuntimeFallbackMetadata({
      canonicalPath: PATH,
      title: `Job market trends temporarily unavailable | ${SITE_NAME}`,
      description: 'The job market trends are temporarily unavailable while the production database reconnects.',
    })
  }
}

type Column = { head: string; left?: boolean }
type Row = { key: string; label: ReactNode; cells: ReactNode[] }

function TrendTable({ caption, first, columns, rows }: { caption: string; first: string; columns: Column[]; rows: Row[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full min-w-[30rem] text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-4 py-3 font-medium">{first}</th>
            {columns.map((c) => (
              <th key={c.head} scope="col" className={`px-4 py-3 font-medium ${c.left ? '' : 'text-right'}`}>{c.head}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-border last:border-0">
              <th scope="row" className="px-4 py-3 font-medium text-foreground">{r.label}</th>
              {r.cells.map((cell, i) => (
                <td key={columns[i].head} className={`px-4 py-3 text-muted-foreground ${columns[i].left ? '' : 'text-right'}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const link = (href: string, text: string) => (
  <Link href={href} className="hover:underline underline-offset-4">
    {text}
  </Link>
)

export default async function TrendsPage() {
  try {
    const [trends, weeks, demand] = await Promise.all([loadMarketTrends(), loadPayWeeks(), loadRoleDemand()])
    const { overall, areas, other, countries, companies } = trends

    const cells = (c: TrendCell) => [n(c.open), share(c.remote, c.open), n(c.newThisWeek), pay(c)]
    const areaColumns: Column[] = [{ head: 'Open jobs' }, { head: 'Remote' }, { head: 'New this week' }, { head: 'Median pay' }]

    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
        { '@type': 'ListItem', position: 2, name: 'Job market trends', item: `${SITE_URL}${PATH}` },
      ],
    }

    return (
      <ListingPage>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <ListingHeader
          breadcrumb={[{ label: 'Home', href: '/' }, { label: 'Job market trends' }]}
          title={HEADING}
          summary={
            <>
              <strong>{n(overall.open)}</strong> open jobs paying $100k or more, <strong>{share(overall.remote, overall.open)}</strong> of them remote.{' '}
              <strong>{n(overall.newThisWeek)}</strong> were posted in the last 7 days, against <strong>{n(overall.newPreviousWeek)}</strong> in the 7 days
              before
              {overall.medianUsd != null ? (
                <>
                  , and the median advertised pay in US dollars is <strong>{money(overall.medianUsd)}</strong>
                </>
              ) : null}
              .
            </>
          }
        />

        <ListingSection title="Hiring by area">
          <TrendTable
            caption="Open six-figure jobs by area: how many, how many are remote, how many were posted in the last 7 days, and the median advertised pay in US dollars"
            first="Area"
            columns={areaColumns}
            rows={[
              ...areas.filter((a) => a.open > 0).map((a) => ({ key: a.slug, label: link(`/jobs/category/${a.slug}`, a.label), cells: cells(a) })),
              { key: 'other', label: 'All other roles', cells: cells(other) },
            ]}
          />
        </ListingSection>

        {weeks.length >= 2 ? (
          <ListingSection title="Pay, week by week">
            <TrendTable
              caption="Weekly snapshot of advertised US-dollar pay in live six-figure listings"
              first="Week of"
              columns={[{ head: 'Median pay' }, { head: 'Middle half' }, { head: 'Listings' }, { head: 'Added in 7 days' }]}
              rows={[...weeks].reverse().map((w) => ({
                key: w.date,
                label: dateLabel(w.date),
                cells: [money(w.median), `${money(w.p25)}–${money(w.p75)}`, n(w.jobs), n(w.newJobs7d)],
              }))}
            />
          </ListingSection>
        ) : null}

        {countries.length > 0 ? (
          <ListingSection title="Where the jobs are">
            <TrendTable
              caption="Countries with the most open six-figure jobs, by the country on the listing"
              first="Country"
              columns={[{ head: 'Open jobs' }, { head: 'Remote' }]}
              rows={countries.map((c) => {
                const slug = countryCodeToSlug(c.code)
                const name = countryName(c.code)
                return { key: c.code, label: slug ? link(`/jobs/location/${slug}`, name) : name, cells: [n(c.open), share(c.remote, c.open)] }
              })}
            />
          </ListingSection>
        ) : null}

        {companies.length > 0 ? (
          <ListingSection title="Hiring the most">
            <TrendTable
              caption="Employers with the most open six-figure jobs"
              first="Company"
              columns={[{ head: 'Open jobs' }, { head: 'New this week' }]}
              rows={companies.map((c) => ({ key: c.companyId, label: c.slug ? link(`/company/${c.slug}`, c.name) : c.name, cells: [n(c.open), n(c.newThisWeek)] }))}
            />
          </ListingSection>
        ) : null}

        {demand ? (
          <ListingSection title="What people apply to">
            <TrendTable
              caption="Roles with the most clicks on Apply in the latest full week"
              first="Role"
              columns={[{ head: `Apply clicks, week of ${dateLabel(demand.weekStart)}` }]}
              rows={demand.roles.map((r) => ({ key: r.roleSlug, label: link(`/jobs/${r.roleSlug}`, roleLabelFor(r.roleSlug)), cells: [n(r.clicks)] }))}
            />
            <p className="mt-2 text-xs text-muted-foreground">Counts of clicks on Apply, nothing about who clicked. Roles under {MIN_DEMAND_CLICKS} clicks are not shown.</p>
          </ListingSection>
        ) : null}

        <ListingSection title="How these numbers are made">
          <Prose>
            <p>
              Every figure comes from the jobs listed on {SITE_NAME} right now: live, not past the age we show, and stating pay of $100k or the local
              equivalent. That makes them numbers about <em>our</em> listings. Nothing here says what jobs pay in general, because jobs below the floor are
              not counted.
            </p>
            <ul>
              <li>
                <strong>Median pay</strong> is the middle of each job&apos;s advertised range, in US dollars only: amounts in other currencies are never
                converted, so they are left out of the median (they are in the job counts). It is shown for a group once at least 3 jobs state a US-dollar range.
              </li>
              <li>
                <strong>New this week</strong> counts jobs posted in the last 7 days, by the employer&apos;s date. A job with no date counts by the day we
                stored it only for a company we were already tracking before that week, so a board we have just started reading does not look all new. It is
                the same rule as the company pages.
              </li>
              <li>
                <strong>Areas</strong> group role titles ({areas.map((a) => a.label).join(', ')}); everything else is under &quot;All other roles&quot;.
              </li>
              <li>
                <strong>Pay, week by week</strong> comes from a weekly snapshot with its own rules (validated pay, job boards that list other employers&apos; jobs
                left out), so its listing counts differ a little from the table above. It appears once there are two weeks of snapshots.
              </li>
            </ul>
            <p>
              The page refreshes about every 30 minutes. For the monthly research with its full method, see the{' '}
              <Link href="/high-paying-jobs-report">six-figure job pay report</Link>, or browse <Link href="/high-paying-jobs">high-paying jobs ranked by pay</Link>.
            </p>
          </Prose>
        </ListingSection>
      </ListingPage>
    )
  } catch (error) {
    unstable_rethrow(error)
    logRuntimeFallback('trends.page', error)
    await skipPrerenderWhileBuilding()
    return (
      <main className="mx-auto max-w-[1600px] px-4 sm:px-6 lg:px-10 pb-14 pt-10">
        <h1 className="text-4xl font-normal tracking-[-0.035em] text-foreground">{HEADING}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          The trends are temporarily unavailable while the production database reconnects. <Link href="/jobs">Browse all jobs</Link>.
        </p>
      </main>
    )
  }
}
