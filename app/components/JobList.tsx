import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildLogoUrl } from '@/lib/companies/logo'
import { JobCardV2 } from '@/components/jobs/JobCardV2'
import { getJobCardSnippet } from '@/lib/jobs/snippet'

export type JobListProps = {
  jobs: JobWithCompany[]
}

export default function JobList({ jobs }: JobListProps) {
  if (!jobs || jobs.length === 0) {
    return (
      <p className="py-6 text-sm text-slate-400">
        No jobs found yet. Try again soon — we&apos;re still ingesting feeds.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FeaturedPromoCard />

      {jobs.map((job) => {
        const companyName =
          job.companyRef?.name?.trim() || (job as any)?.company?.trim() || 'Company'

        const logo = buildLogoUrl(
          job.companyRef?.logoUrl ?? (job as any)?.companyLogo ?? null,
          job.companyRef?.website ?? null,
        )

        const salaryMin = bigIntToNumberSafe((job as any)?.minAnnual)
        const salaryMax = bigIntToNumberSafe((job as any)?.maxAnnual)

        const isRemote =
          (job as any)?.remote === true ||
          (job as any)?.remoteMode === 'remote' ||
          (job as any)?.remoteMode === 'hybrid'

        const location = buildLocationLabel(job as any)
        const snippet = getJobCardSnippet(job as any)

        const skills = parseStringArray((job as any)?.skillsJson)
          .filter(Boolean)
          .slice(0, 8)

        // ✅ Job-board-friendly: prefer postedAt, otherwise show “freshness”
        // This stops “16h ago” when scraper revalidated thousands of jobs recently.
        const postedAt =
          ((job as any)?.postedAt as any) ||
          ((job as any)?.updatedAt as any) ||
          ((job as any)?.createdAt as any) ||
          new Date()

        const featured =
          Boolean((job as any)?.featured) ||
          ((job as any)?.featureExpiresAt
            ? new Date((job as any).featureExpiresAt).getTime() > Date.now()
            : false)

        return (
          <JobCardV2
            key={job.id}
            featured={featured}
            job={{
              id: job.id,
              title: job.title,
              company: { name: companyName, logo },
              location,
              isRemote,
              salaryMin: salaryMin || 100_000,
              salaryMax: salaryMax || null,
              skills,
              postedAt,
              snippet,
            }}
          />
        )
      })}
    </div>
  )
}

function FeaturedPromoCard() {
  return (
    <article className="rounded-2xl border border-amber-500/60 bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-950 p-5 text-sm text-slate-200 shadow-lg shadow-amber-500/20">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">
        <span>✨ Featured spotlight</span>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-900 ring-1 ring-amber-300">
          Paid listing
        </span>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-sm font-semibold text-slate-900 shadow-inner shadow-amber-500/40">
              🏷️
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-50">
                Showcase your $100k+ role at the top of the feed
              </h3>
              <p className="text-[13px] text-slate-200">
                Branded placement above organic roles with a bold apply CTA.
                Ideal for remote, hybrid, or on-site six-figure openings.
              </p>
            </div>
          </div>
        </div>

        <a
          href="/post-a-job"
          className="inline-flex items-center rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 shadow-md shadow-amber-500/30 hover:bg-amber-300"
        >
          🚀 Post a featured job
        </a>
      </div>
    </article>
  )
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function bigIntToNumberSafe(v: unknown): number | null {
  if (v === null || v === undefined) return null
  try {
    if (typeof v === 'bigint') return Number(v)
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    if (typeof v === 'string' && v.trim()) {
      const n = Number(v)
      return Number.isFinite(n) ? n : null
    }
    return null
  } catch {
    return null
  }
}

function parseStringArray(raw?: string | null): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function buildLocationLabel(job: any): string | null {
  const isRemote =
    job?.remote === true ||
    job?.remoteMode === 'remote' ||
    job?.remoteMode === 'hybrid'

  if (isRemote) {
    const cc = job?.countryCode ? String(job.countryCode).toUpperCase() : null
    return cc ? `🌍 Remote (${cc})` : '🌍 Remote'
  }

  const city = job?.city ? String(job.city).trim() : ''
  const cc = job?.countryCode ? String(job.countryCode).toUpperCase() : ''

  if (city && cc) return `📍 ${city}, ${cc}`
  if (job?.locationRaw) return `📍 ${String(job.locationRaw).trim()}`
  if (cc) return `📍 ${cc}`

  return null
}
