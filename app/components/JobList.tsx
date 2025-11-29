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
      {jobs.map((job) => (
        <JobCard key={job.id} job={job} />
      ))}
    </div>
  )
}
