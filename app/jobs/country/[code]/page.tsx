import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl } from '../../../../lib/seo/site'
import { countryCodeToSlug, countrySlugToCode } from '../../../../lib/seo/countrySlug'
import { redirect } from 'next/navigation'

export const revalidate = 300

const SITE_URL = getSiteUrl()

const COUNTRIES: Record<string, { name: string; flag: string }> = {
  'united-states': { name: 'United States', flag: '🇺🇸' },
  'united-kingdom': { name: 'United Kingdom', flag: '🇬🇧' },
  canada: { name: 'Canada', flag: '🇨🇦' },
  germany: { name: 'Germany', flag: '🇩🇪' },
  australia: { name: 'Australia', flag: '🇦🇺' },
  france: { name: 'France', flag: '🇫🇷' },
  netherlands: { name: 'Netherlands', flag: '🇳🇱' },
  sweden: { name: 'Sweden', flag: '🇸🇪' },
}

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params
  const country = COUNTRIES[code.toLowerCase()]
  if (!country) return { title: 'Not Found' }

  // Support legacy code-based slugs by redirecting
  const legacyCode = countrySlugToCode(code)
  if (legacyCode) {
    const legacySlug = countryCodeToSlug(legacyCode)
    if (legacySlug && COUNTRIES[legacySlug.toLowerCase()]) {
      // canonical will use the full-name slug
    }
  }

  const resolvedCode = countrySlugToCode(code)
  if (!resolvedCode) return { title: 'Not Found' }

  const { total } = await queryJobs({
    countryCode: resolvedCode.toUpperCase(),
    minAnnual: 100_000,
    pageSize: 1,
  })

  const title = total > 0
    ? `$100k+ Jobs in ${country.name} - ${total.toLocaleString()} Positions | Six Figure Jobs`
    : `$100k+ Jobs in ${country.name} | Six Figure Jobs`

  const description = total > 0
    ? `Find ${total.toLocaleString()} high-salary tech jobs in ${country.name}. Remote, hybrid, and on-site positions paying $100k+. Engineering, product, data roles. Updated daily.`
    : `High-salary tech jobs in ${country.name}. Remote, hybrid, and on-site positions paying $100k+ at top companies.`

  const allowIndex = total >= 3
  const canonical = `${SITE_URL}/jobs/country/${code.toLowerCase()}`

  return {
    title,
    description,
    alternates: { canonical },
    robots: allowIndex ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      title,
      description,
      url: canonical,
      siteName: 'Six Figure Jobs',
      type: 'website',
      images: [
        {
          url: `${SITE_URL}/og-country-${code.toLowerCase()}.png`,
          width: 1200,
          height: 630,
          alt: `$100k+ Jobs in ${country.name}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`${SITE_URL}/og-country-${code.toLowerCase()}.png`],
    },
  }
}

export default async function CountryPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const normalizedSlug = code.toLowerCase()
  const country = COUNTRIES[normalizedSlug]

  // Redirect legacy code slugs (us/gb/ca) to full-name slug if present
  if (!country) {
    const asCode = code.toUpperCase()
    const slugFromCode = countryCodeToSlug(asCode)
    if (slugFromCode && COUNTRIES[slugFromCode]) {
      redirect(`/jobs/country/${slugFromCode}`)
    }
    notFound()
  }

  const countryCode = countrySlugToCode(code)
  if (!countryCode) notFound()

  const { jobs, total } = await queryJobs({
    countryCode: countryCode.toUpperCase(),
    minAnnual: 100_000,
    pageSize: 40,
  })

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li>{country.flag} {country.name}</li>
        </ol>
      </nav>

      <h1 className="mb-4 text-2xl font-semibold text-slate-50">
        {country.flag} $100k+ Jobs in {country.name} ({total.toLocaleString()})
      </h1>
      <p className="mb-6 text-sm text-slate-300">
        High-salary tech positions in {country.name} from top companies.
      </p>

      {jobs.length === 0 ? (
        <p className="text-slate-400">No jobs found.</p>
      ) : (
        <JobList jobs={jobs as JobWithCompany[]} />
      )}

      <section className="mt-12 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">Related Searches</h2>
        <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
          <Link href="/jobs/category/engineering" className="text-blue-400 hover:underline">
            Engineering Jobs in {country.name}
          </Link>
          <Link href="/jobs/category/product" className="text-blue-400 hover:underline">
            Product Jobs in {country.name}
          </Link>
          <Link href="/jobs/level/senior" className="text-blue-400 hover:underline">
            Senior Jobs in {country.name}
          </Link>
          <Link href="/jobs/200k-plus" className="text-blue-400 hover:underline">
            $200k+ Jobs in {country.name}
          </Link>
          <Link href="/jobs/100k-plus" className="text-blue-400 hover:underline">
            All $100k+ Jobs
          </Link>
          {Object.entries(COUNTRIES)
            .filter(([c]) => c !== code.toLowerCase())
            .slice(0, 3)
            .map(([c, info]) => (
              <Link key={c} href={`/jobs/country/${c}`} className="text-blue-400 hover:underline">
                Jobs in {info.name}
              </Link>
            ))}
        </div>
      </section>
    </main>
  )
}
