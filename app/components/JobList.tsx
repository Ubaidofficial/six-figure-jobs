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
    <article className="rounded-2xl border border-amber-500/40 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 p-4 text-sm text-slate-200 shadow-lg shadow-amber-500/10">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-amber-300">
        <span>Featured spotlight</span>
        <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] text-amber-200 ring-1 ring-amber-500/50">
          Paid listing
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h3 className="text-base font-semibold text-slate-50">
            Showcase your $100k+ role to motivated candidates
          </h3>
          <p className="text-[13px] text-slate-300">
            Your job appears above organic roles, with logo, branding, and a clear apply CTA.
            Perfect for remote, hybrid, or on-site six-figure openings.
          </p>
        </div>
        <a
          href="/post-a-job"
          className="inline-flex items-center rounded-full bg-amber-500 px-4 py-2 text-xs font-semibold text-slate-950 shadow-md shadow-amber-500/30 hover:bg-amber-400"
        >
          Post a featured job
        </a>
      </div>
    </article>
  )
}
