import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../lib/jobs/queryJobs'
import JobList from '../../components/JobList'

export const revalidate = 300

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://sixfigurejobs.com'

function formatRoleTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/^Senior Senior /, 'Senior ')
    .replace(/^Staff Staff /, 'Staff ')
    .replace(/^Manager Manager /, 'Manager ')
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
    return { title: 'Jobs Not Found | Six Figure Jobs' }
  }

  const roleTitle = formatRoleTitle(role)
  
  const salaries = jobs
    .map(j => Number(j.minAnnual || 0))
    .filter(s => s > 0)
    .sort((a, b) => a - b)
  
  const minSalary = salaries[0] || 100000
  const maxSalary = salaries[salaries.length - 1] || 200000
  
  const salaryRange = maxSalary >= 200000 
    ? `$${Math.floor(minSalary / 1000)}k-$${Math.floor(maxSalary / 1000)}k`
    : `$${Math.floor(minSalary / 1000)}k+`
  
  const remoteCount = jobs.filter(j => j.remote || j.remoteMode === 'remote').length
  const isRemote = remoteCount > total * 0.5
  
  const title = isRemote
    ? `${roleTitle} Jobs (${salaryRange}) - ${total} Remote Roles`
    : `${roleTitle} Jobs - ${total} Positions Paying ${salaryRange}`
  
  const description = `Find ${total} ${roleTitle.toLowerCase()} jobs paying ${salaryRange}. Remote and on-site positions at top tech companies. Updated daily.`

  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/jobs/${role}` },
    openGraph: {
      title: `${roleTitle} Jobs - ${total} High-Paying Positions`,
      description,
      url: `${SITE_URL}/jobs/${role}`,
      siteName: 'Six Figure Jobs',
      type: 'website',
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

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
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
        {roleTitle} Jobs ({total.toLocaleString()})
      </h1>
      <p className="mb-6 text-sm text-slate-300">
        High-salary {roleTitle.toLowerCase()} positions paying $100k+ from top companies.
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
    </main>
  )
}