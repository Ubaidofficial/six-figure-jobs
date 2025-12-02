// app/components/JobList.tsx

import JobCard, { type JobCardJob } from './JobCard'

export type JobListProps = {
  // expects JobWithCompany[] from queryJobs (with companyRef, etc.)
  jobs: JobCardJob[]
}

/**
 * Job list used on the homepage and slice pages.
 */
export default function JobList({ jobs }: JobListProps) {
  if (!jobs || jobs.length === 0) {
    return (
      <p className="py-6 text-sm text-slate-400">
        No jobs found yet. Try again soon — we&apos;re still ingesting
        feeds.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <FeaturedPromoCard />
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}

function FeaturedPromoCard() {
  return (
    <article className="rounded-2xl border border-amber-500/60 bg-gradient-to-r from-amber-500/15 via-slate-900 to-slate-950 p-5 text-sm text-slate-200 shadow-lg shadow-amber-500/20">
      <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-amber-200">
        <span>Featured spotlight</span>
        <span className="rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] text-amber-900 ring-1 ring-amber-300">
          Paid listing
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/90 text-sm font-semibold text-slate-900 shadow-inner shadow-amber-500/40">
              Logo
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-50">
                Showcase your $100k+ role at the top of the feed
              </h3>
              <p className="text-[13px] text-slate-200">
                Branded placement above organic roles with a bold apply CTA. Ideal for remote, hybrid, or on-site six-figure openings.
              </p>
            </div>
          </div>
        </div>
        <a
          href="/post-a-job"
          className="inline-flex items-center rounded-full bg-amber-400 px-4 py-2 text-xs font-semibold text-slate-900 shadow-md shadow-amber-500/30 hover:bg-amber-300"
        >
          Post a featured job
        </a>
      </div>
    </article>
  )
}
