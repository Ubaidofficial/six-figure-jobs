import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../lib/jobs/queryJobs'
import JobList from '../../components/JobList'
import { getSiteUrl, SITE_NAME } from '../../../lib/seo/site'

export const revalidate = 300

const SITE_URL = getSiteUrl()

function formatRoleTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/^Senior Senior /, 'Senior ')
    .replace(/^Staff Staff /, 'Staff ')
    .replace(/^Manager Manager /, 'Manager ')
}

function RoleFAQSchema({
  role,
  roleTitle,
  count,
  avgMin,
  avgMax,
}: {
  role: string
  roleTitle: string
  count: number
  avgMin: number
  avgMax: number
}) {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: [
      {
        '@type': 'Question',
        name: `What is the average salary for $100k+ ${roleTitle} jobs?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `The average salary for $100k+ ${roleTitle.toLowerCase()} positions ranges from $${Math.round(
            avgMin / 1000,
          )}k to $${Math.round(avgMax / 1000)}k per year based on ${count} verified job postings.`,
        },
      },
      {
        '@type': 'Question',
        name: `How many $100k+ ${roleTitle} jobs are available?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `There are currently ${count.toLocaleString()} $100k+ ${roleTitle.toLowerCase()} positions available on Six Figure Jobs.`,
        },
      },
      {
        '@type': 'Question',
        name: `Are there remote ${roleTitle} jobs paying $100k+?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Yes! Many $100k+ ${roleTitle.toLowerCase()} positions offer remote work. Filter by "Remote" to see all remote ${roleTitle.toLowerCase()} jobs.`,
        },
      },
      {
        '@type': 'Question',
        name: `What companies hire $100k+ ${roleTitle}s?`,
        acceptedAnswer: {
          '@type': 'Answer',
          text: `Top companies hiring $100k+ ${roleTitle.toLowerCase()}s include Google, Meta, Stripe, OpenAI, Anthropic, Netflix, and many more leading tech companies.`,
        },
      },
    ],
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  )
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ role: string }> 
}): Promise<Metadata> {
  const { role } = await params
  
  const { jobs, total } = await queryJobs({
    roleSlugs: [role],
    minAnnual: 100_000,
    pageSize: 40,
  })

  if (total === 0) {
    return { title: 'Not Found' }
  }

  const roleTitle = formatRoleTitle(role)
  const jobCount = total
  const title = `${roleTitle} Jobs Paying $100k+ | ${jobCount.toLocaleString()} Positions`
  const description = `Find ${jobCount.toLocaleString()} verified ${roleTitle} jobs paying $100k+ USD. Remote, hybrid, and on-site six-figure positions. Updated daily.`
  const imageUrl = 'https://www.6figjobs.com/og-image.png'

  return {
    title,
    description,
    alternates: {
      canonical: `https://www.6figjobs.com/jobs/${role}`,
    },
    openGraph: {
      title,
      description,
      url: `https://www.6figjobs.com/jobs/${role}`,
      siteName: SITE_NAME,
      type: 'website',
      images: [
        {
          url: imageUrl,
          width: 1200,
          height: 630,
          alt: `${roleTitle} Jobs Paying $100k+`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [imageUrl],
    },
  }
}

export default async function RolePage({ 
  params 
}: { 
  params: Promise<{ role: string }> 
}) {
  const { role } = await params
  
  const { jobs, total } = await queryJobs({
    roleSlugs: [role],
    minAnnual: 100_000,
    pageSize: 40,
  })

  if (total === 0) notFound()

  const roleTitle = formatRoleTitle(role)
  const jobCount = total

  const minAnnualValues = jobs
    .map((j) => (j.minAnnual != null ? Number(j.minAnnual) : null))
    .filter((v): v is number => v != null && v > 0)
  const maxAnnualValues = jobs
    .map((j) => (j.maxAnnual != null ? Number(j.maxAnnual) : null))
    .filter((v): v is number => v != null && v > 0)

  const avgSalaryMin =
    minAnnualValues.length > 0
      ? minAnnualValues.reduce((sum, v) => sum + v, 0) / minAnnualValues.length
      : 100_000
  const avgSalaryMax =
    maxAnnualValues.length > 0
      ? maxAnnualValues.reduce((sum, v) => sum + v, 0) / maxAnnualValues.length
      : Math.max(avgSalaryMin, 200_000)

  const locationCounts = new Map<string, number>()
  jobs.forEach(job => {
    if (job.countryCode) {
      const count = locationCounts.get(job.countryCode) || 0
      locationCounts.set(job.countryCode, count + 1)
    }
  })

  const topLocations = Array.from(locationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

  const salary200kPlus = jobs.filter(j => j.minAnnual && j.minAnnual >= 200000n).length
  const salary300kPlus = jobs.filter(j => j.minAnnual && j.minAnnual >= 300000n).length
  const salary400kPlus = jobs.filter(j => j.minAnnual && j.minAnnual >= 400000n).length

  const companyCounts = new Map<string, { name: string; count: number; slug?: string | null }>()
  jobs.forEach((job: any) => {
    const key = job.companyId || job.company || job.companyRef?.name
    if (!key) return
    const existing =
      companyCounts.get(key) ?? {
        name: job.companyRef?.name ?? job.company,
        count: 0,
        slug: job.companyRef?.slug ?? null,
      }
    existing.count += 1
    companyCounts.set(key, existing)
  })
  const topCompanies = Array.from(companyCounts.values())
    .filter((c) => !!c.name)
    .sort((a, b) => b.count - a.count)
    .slice(0, 6)

  const faqs = [
    {
      q: `Are these ${roleTitle} jobs really $100k+?`,
      a: 'Yes. We include roles with published or inferred compensation of $100k+ (or local equivalent) from ATS feeds and vetted boards.',
    },
    {
      q: `How often are ${roleTitle} listings refreshed?`,
      a: 'We scrape ATS sources daily, expire stale jobs, and keep the newest high-paying roles on top.',
    },
    {
      q: `Do you include remote and hybrid ${roleTitle} roles?`,
      a: 'Yes. Use remote/hybrid filters on the search page or check the remote slices for this role.',
    },
  ]

  const breadcrumbJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE_URL}/` },
      { '@type': 'ListItem', position: 2, name: '$100k+ jobs', item: `${SITE_URL}/jobs/100k-plus` },
      { '@type': 'ListItem', position: 3, name: `${roleTitle} jobs`, item: `${SITE_URL}/jobs/${role}` },
    ],
  }

  const itemListJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${roleTitle} jobs paying $100k+`,
    itemListElement: (jobs as JobWithCompany[]).slice(0, 40).map((job, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      item: {
        '@type': 'JobPosting',
        title: job.title,
        hiringOrganization: {
          '@type': 'Organization',
          name: job.companyRef?.name || job.company,
        },
        jobLocation: job.countryCode
          ? {
              '@type': 'Country',
              addressCountry: job.countryCode,
            }
          : undefined,
        url: `${SITE_URL}/job/${job.id}`,
      },
    })),
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListJsonLd) }}
      />
      <RoleFAQSchema
        role={role}
        roleTitle={roleTitle}
        count={jobCount}
        avgMin={avgSalaryMin}
        avgMax={avgSalaryMax}
      />
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li>{roleTitle}</li>
        </ol>
      </nav>

      <h1 className="mb-4 text-2xl font-semibold text-slate-50">
        {roleTitle} Jobs ({total.toLocaleString()}) — $100k+
      </h1>
      <p className="mb-6 text-sm text-slate-300">
        Browse{' '}
        <strong className="text-white">{jobCount.toLocaleString()}</strong>{' '}
        {roleTitle.toLowerCase()} <strong className="text-green-500">$100k</strong>{' '}
        jobs with verified{' '}
        <strong className="text-green-500">six figure salaries</strong>. Find{' '}
        <strong className="text-white">high paying</strong>{' '}
        {roleTitle.toLowerCase()} positions paying{' '}
        <strong className="text-green-500">$100k+</strong> from $
        {Math.round(avgSalaryMin).toLocaleString()} to $
        {Math.round(avgSalaryMax).toLocaleString()} at top companies like{' '}
        {topCompanies
          .slice(0, 3)
          .map((company) => company.name)
          .join(', ')}
        .
      </p>

      <section className="mb-6 rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <div className="space-y-3">
          {topLocations.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Location:</span>
              {topLocations.map(([code, count]) => (
                <Link
                  key={code}
                  href={`/jobs/${role}/${code.toLowerCase()}`}
                  className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs text-slate-200 hover:border-slate-500"
                >
                  {code} ({count})
                </Link>
              ))}
            </div>
          )}
          
          {(salary200kPlus > 0 || salary300kPlus > 0 || salary400kPlus > 0) && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Salary:</span>
              
              {salary200kPlus > 0 && (
                <Link
                  href={`/jobs/${role}/200k-plus`}
                  className="rounded-full border border-blue-700 bg-blue-950 px-3 py-1.5 text-xs text-blue-200 hover:border-blue-500"
                >
                  $200k+ ({salary200kPlus})
                </Link>
              )}
              
              {salary300kPlus > 0 && (
                <Link
                  href={`/jobs/${role}/300k-plus`}
                  className="rounded-full border border-purple-700 bg-purple-950 px-3 py-1.5 text-xs text-purple-200 hover:border-purple-500"
                >
                  $300k+ ({salary300kPlus})
                </Link>
              )}
              
              {salary400kPlus > 0 && (
                <Link
                  href={`/jobs/${role}/400k-plus`}
                  className="rounded-full border border-amber-700 bg-amber-950 px-3 py-1.5 text-xs text-amber-200 hover:border-amber-500"
                >
                  $400k+ ({salary400kPlus})
                </Link>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
        <p>
          Find verified $100k+ {roleTitle.toLowerCase()} roles across remote, hybrid, and on-site teams.
          We refresh ATS feeds daily and rank by salary first, so you see the strongest offers up top.
        </p>
      </section>

      <JobList jobs={jobs as JobWithCompany[]} />

      <section className="mt-12 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">Related {roleTitle} Jobs</h2>
        <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
          {topLocations.slice(0, 3).map(([code]) => (
            <Link 
              key={code}
              href={`/jobs/${role}/${code.toLowerCase()}`} 
              className="text-blue-400 hover:underline"
            >
              {roleTitle} Jobs in {code.toUpperCase()}
            </Link>
          ))}
          
          {salary200kPlus > 0 && (
            <Link href={`/jobs/${role}/200k-plus`} className="text-blue-400 hover:underline">
              $200k+ {roleTitle} Jobs
            </Link>
          )}
          
          <Link href="/jobs/100k-plus" className="text-blue-400 hover:underline">
            All $100k+ Jobs
          </Link>
        </div>
      </section>

      {topCompanies.length > 0 && (
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-50">
            Top companies hiring for {roleTitle}
          </h2>
          <div className="flex flex-wrap gap-2 text-xs text-slate-300">
            {topCompanies.map((c) => (
              <Link
                key={`${c.name}-${c.slug ?? ''}`}
                href={c.slug ? `/company/${c.slug}` : '#'}
                className="inline-flex items-center gap-2 rounded-full border border-slate-800 bg-slate-900 px-3 py-1.5 hover:border-slate-600"
              >
                <span className="font-semibold text-slate-100">{c.name}</span>
                <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[11px] text-slate-400">
                  {c.count} roles
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mt-10 space-y-3 rounded-2xl border border-slate-800 bg-slate-950/60 p-4">
        <h2 className="text-sm font-semibold text-slate-50">
          FAQs about high-paying {roleTitle} jobs
        </h2>
        <div className="space-y-3 text-sm text-slate-300">
          {faqs.map((item) => (
            <div key={item.q}>
              <p className="font-semibold text-slate-100">{item.q}</p>
              <p className="text-slate-300">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
