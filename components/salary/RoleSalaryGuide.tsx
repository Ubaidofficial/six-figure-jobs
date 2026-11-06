import type { ReactNode } from 'react'
import Link from 'next/link'

import { PageSection } from '@/components/seo/PageChrome'
import { CountryFlag } from '@/components/ui/CountryFlag'
import { countryName } from '@/lib/location/country'
import { formatPay, levelLabel } from '@/lib/salary/roleGuideContent'
import type { RoleSalaryGuide } from '@/lib/salary/roleGuide'

// Real <table> elements (not div grids): they are what search and answer engines read as tabular data.
function DataTable({ caption, head, rows }: { caption: string; head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
            {head.map((h, i) => (
              <th key={h} scope="col" className={`py-2 pr-4 font-medium ${i > 0 ? 'text-right' : ''}`}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, r) => (
            <tr key={r} className="border-b border-border/60">
              {cells.map((cell, i) =>
                i === 0 ? (
                  <th key={i} scope="row" className="py-2.5 pr-4 font-medium text-foreground">
                    {cell}
                  </th>
                ) : (
                  <td key={i} className="py-2.5 pr-4 text-right font-mono text-foreground">
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

/** The data sections of /salary/[role]: each is headed by the question it answers and holds one table. */
export function RoleSalarySections({
  roleName,
  bandLabel,
  guide,
}: {
  roleName: string
  bandLabel: string
  guide: RoleSalaryGuide
}) {
  const u = guide.usd
  return (
    <>
      {u ? (
        <PageSection
          title={`How much does a ${roleName} make?`}
          description={`A ${roleName} makes a median of ${formatPay(u.median)} a year in our ${bandLabel} listings. Each listing counts once, at the midpoint of its pay range.`}
        >
          <DataTable
            caption={`${roleName} annual pay in USD, ${bandLabel} listings`}
            head={['Measure', 'Annual pay (USD)']}
            rows={[
              ['25th percentile', formatPay(u.p25)],
              ['Median', formatPay(u.median)],
              ['75th percentile', formatPay(u.p75)],
              ['Lowest listing', formatPay(u.lowest)],
              ['Highest listing', formatPay(u.highest)],
              ['Listings counted', u.count.toLocaleString('en-US')],
            ]}
          />
        </PageSection>
      ) : null}

      {guide.levels ? (
        <PageSection
          title={`How does ${roleName} pay change with experience level?`}
          description={`Median pay by experience level for ${roleName} roles in our ${bandLabel} listings (USD). Levels with fewer than 5 listings are left out.`}
        >
          <DataTable
            caption={`${roleName} median annual pay by experience level, USD`}
            head={['Level', 'Listings', 'Median pay']}
            rows={guide.levels.map((l) => [levelLabel(l.level), l.count.toLocaleString('en-US'), formatPay(l.median)])}
          />
        </PageSection>
      ) : null}

      {guide.companies.length > 0 ? (
        <PageSection
          title={`Which companies are hiring for ${roleName} roles at ${bandLabel}?`}
          description={`Companies with at least 2 open ${bandLabel} ${roleName} listings, ordered by number of listings.`}
        >
          <DataTable
            caption={`Companies with the most open ${roleName} listings`}
            head={['Company', 'Open listings', 'Median pay']}
            rows={guide.companies.map((c) => [
              <Link key={c.slug} href={`/company/${c.slug}`} className="text-primary hover:underline">
                {c.name}
              </Link>,
              c.count.toLocaleString('en-US'),
              formatPay(c.median),
            ])}
          />
        </PageSection>
      ) : null}

      {guide.countries.length > 0 ? (
        <PageSection
          title={`How does ${roleName} pay compare across countries?`}
          description="Each country is shown in its own currency, so the rows are not comparable with each other. Countries with fewer than 5 listings are left out."
        >
          <DataTable
            caption={`${roleName} annual pay by country, in each country's currency`}
            head={['Country', 'Currency', 'Listings', 'Median pay', 'Middle half']}
            rows={guide.countries.map((c) => [
              <span className="inline-flex items-center gap-2">
                <CountryFlag code={c.countryCode} />
                {countryName(c.countryCode) ?? c.countryCode}
              </span>,
              c.currency,
              c.count.toLocaleString('en-US'),
              formatPay(c.median, c.currency),
              `${formatPay(c.p25, c.currency)} to ${formatPay(c.p75, c.currency)}`,
            ])}
          />
        </PageSection>
      ) : null}
    </>
  )
}
