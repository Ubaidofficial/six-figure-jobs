import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { queryJobs, type JobWithCompany } from '../../../../lib/jobs/queryJobs'
import JobList from '../../../components/JobList'
import { getSiteUrl } from '../../../../lib/seo/site'
import { countryCodeToSlug, countrySlugToCode } from '../../../../lib/seo/countrySlug'

export const revalidate = 300

const SITE_URL = getSiteUrl()

const LOCATIONS: Record<string, string> = {
  'united-states': 'United States',
  'united-kingdom': 'United Kingdom',
  canada: 'Canada',
  germany: 'Germany',
  australia: 'Australia',
  france: 'France',
  netherlands: 'Netherlands',
  sweden: 'Sweden',
}

const SALARY_TIERS: Record<string, number> = {
  '100k-plus': 100_000,
  '200k-plus': 200_000,
  '300k-plus': 300_000,
  '400k-plus': 400_000,
}

function formatRoleTitle(slug: string): string {
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/^Senior Senior /, 'Senior ')
    .replace(/^Staff Staff /, 'Staff ')
    .replace(/^Manager Manager /, 'Manager ')
}

// Determine if filter is location or salary
function parseFilter(filter: string): { type: 'location' | 'salary'; value: string | number; label: string } {
  if (LOCATIONS[filter]) {
    const code = countrySlugToCode(filter)
    if (!code) throw new Error('Unknown location filter')
    return { type: 'location', value: code, label: LOCATIONS[filter] }
  }
  if (filter.length === 2) {
    const slug = countryCodeToSlug(filter.toUpperCase())
    if (LOCATIONS[slug]) {
      const code = countrySlugToCode(slug)
      if (!code) throw new Error('Unknown location filter')
      return { type: 'location', value: code, label: LOCATIONS[slug] }
    }
  }
  if (SALARY_TIERS[filter]) {
    return { type: 'salary', value: SALARY_TIERS[filter], label: filter.replace('-plus', '+').toUpperCase() }
  }
  throw new Error('Invalid filter')
}

export async function generateMetadata({ 
  params 
}: { 
  params: Promise<{ role: string; filter: string }> 
}): Promise<Metadata> {
  const { role, filter } = await params
  
  try {
    const parsed = parseFilter(filter)
    const roleTitle = formatRoleTitle(role)
    
    const queryInput: any = {
      roleSlugs: [role],
      minAnnual: parsed.type === 'salary' ? parsed.value as number : 100_000,
      pageSize: 40,
    }
    
    if (parsed.type === 'location') {
      queryInput.countryCode = parsed.value
    }
    
    const { jobs, total } = await queryJobs(queryInput)
    
    if (total === 0) {
      return { title: 'Jobs Not Found | Six Figure Jobs' }
    }
    
    // Calculate actual salary range
    const salaries = jobs
      .map(j => Number(j.minAnnual || 0))
      .filter(s => s > 0)
      .sort((a, b) => a - b)
    
    const minSalary = salaries[0] || 100000
    const maxSalary = salaries[salaries.length - 1] || 200000
    const salaryRange = `$${Math.floor(minSalary / 1000)}k-$${Math.floor(maxSalary / 1000)}k`
    
    // Build optimized title
    let title: string
    let description: string
    
    if (parsed.type === 'location') {
      const remoteCount = jobs.filter(j => j.remote || j.remoteMode === 'remote').length
      const shortLoc = parsed.value as string
      
      title = remoteCount > total * 0.3
        ? `${roleTitle} Jobs ${shortLoc} - ${total} Remote (${salaryRange})`
        : `${roleTitle} Jobs in ${parsed.label} - ${total} Positions`
      
      description = `${total} ${roleTitle.toLowerCase()} jobs in ${parsed.label} paying ${salaryRange}. ${remoteCount > 0 ? `${remoteCount} remote positions.` : ''} Top companies hiring now.`
    } else {
      const salaryLabel = parsed.label
      
      title = `${roleTitle} ${salaryLabel} Jobs - ${total} Elite Positions`
      description = `${total} ${roleTitle.toLowerCase()} jobs paying ${salaryLabel}. Senior and staff-level positions at top tech companies. Updated daily.`
    }

    return {
      title,
      description,
      alternates: { canonical: `${SITE_URL}/jobs/${role}/${filter}` },
      openGraph: {
        title: `${roleTitle} Jobs ${parsed.label} - ${total} High-Paying Roles`,
        description,
        url: `${SITE_URL}/jobs/${role}/${filter}`,
        siteName: 'Six Figure Jobs',
        type: 'website',
      },
      twitter: {
        card: 'summary_large_image',
        title,
        description,
      },
    }
  } catch {
    return { title: 'Not Found' }
  }
}

export default async function RoleFilterPage({ 
  params 
}: { 
  params: Promise<{ role: string; filter: string }> 
}) {
  const { role, filter } = await params

  if (filter.length === 2) {
    const slug = countryCodeToSlug(filter.toUpperCase())
    if (LOCATIONS[slug]) {
      redirect(`/jobs/${role}/${slug}`)
    }
  }
  
  let parsed: { type: 'location' | 'salary'; value: string | number; label: string }
  
  try {
    parsed = parseFilter(filter)
  } catch {
    notFound()
  }
  
  const roleTitle = formatRoleTitle(role)
  
  const queryInput: any = {
    roleSlugs: [role],
    minAnnual: parsed.type === 'salary' ? parsed.value as number : 100_000,
    pageSize: 40,
  }
  
  if (parsed.type === 'location') {
    queryInput.countryCode = parsed.value
  }
  
  const { jobs, total } = await queryJobs(queryInput)
  
  if (total === 0) notFound()

  return (
    <main className="mx-auto max-w-6xl px-4 pb-12 pt-10">
      <nav aria-label="Breadcrumb" className="mb-4 text-xs text-slate-400">
        <ol className="flex items-center gap-1">
          <li><Link href="/">Home</Link></li>
          <li className="px-1">/</li>
          <li><Link href="/jobs/100k-plus">Jobs</Link></li>
          <li className="px-1">/</li>
          <li><Link href={`/jobs/${role}`}>{roleTitle}</Link></li>
          <li className="px-1">/</li>
          <li>{parsed.label}</li>
        </ol>
      </nav>

      <h1 className="mb-4 text-2xl font-semibold text-slate-50">
        {roleTitle} Jobs {parsed.type === 'location' ? `in ${parsed.label}` : parsed.label} ({total.toLocaleString()})
      </h1>
      
      <p className="mb-6 text-sm text-slate-300">
        {parsed.type === 'location' 
          ? `High-salary ${roleTitle.toLowerCase()} positions in ${parsed.label} from top companies.`
          : `${roleTitle} positions paying ${parsed.label} at elite tech companies.`
        }
      </p>

      <JobList jobs={jobs as JobWithCompany[]} />

      <section className="mt-12 rounded-xl border border-slate-800 bg-slate-950/50 p-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-50">Related Searches</h2>
        <div className="grid gap-2 text-xs sm:grid-cols-2 md:grid-cols-3">
          <Link href={`/jobs/${role}`} className="text-blue-400 hover:underline">
            All {roleTitle} Jobs
          </Link>
          
          {parsed.type === 'location' ? (
            <>
              <Link href={`/jobs/${role}/200k-plus`} className="text-blue-400 hover:underline">
                $200k+ {roleTitle} in {parsed.label}
              </Link>
              <Link
                href={`/jobs/country/${countryCodeToSlug(parsed.value as string)}`}
                className="text-blue-400 hover:underline"
              >
                All Jobs in {parsed.label}
              </Link>
            </>
          ) : (
            <>
              <Link href={`/jobs/${role}/united-states`} className="text-blue-400 hover:underline">
                {roleTitle} {parsed.label} in USA
              </Link>
              <Link href={`/jobs/${parsed.value === 200_000 ? '300k-plus' : '200k-plus'}`} className="text-blue-400 hover:underline">
                All {parsed.value === 200_000 ? '$300k+' : '$200k+'} Jobs
              </Link>
            </>
          )}
          
          <Link href="/jobs/100k-plus" className="text-blue-400 hover:underline">
            All $100k+ Jobs
          </Link>
        </div>
      </section>
    </main>
  )
}
