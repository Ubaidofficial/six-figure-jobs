import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { JobCard } from '@/components/jobs/JobCard'

export type JobListProps = {
  jobs: JobWithCompany[]
}

export default function JobList({ jobs }: JobListProps) {
  if (!jobs || jobs.length === 0) {
    return (
      <p className="py-6 text-sm text-slate-400">
        No jobs found. Try adjusting your filters or explore all $100k+ opportunities.
      </p>
    )
  }

  // ✅ UI dedupe: collapse identical ATS duplicates (same company + title + comp)
  const seen = new Set<string>()
  const dedupedJobs = jobs.filter((job: any) => {
    const companyId = job.companyId || job.companyRef?.id || ''
    const title = (job.title || '').trim().toLowerCase()
    const min = String(job.minAnnual ?? '')
    const max = String(job.maxAnnual ?? '')
    const key = `${companyId}:${title}:${min}:${max}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  return (
    <div className="flex flex-col gap-3">
      {dedupedJobs.map((job) => (
        <JobCard key={job.id} job={job as JobWithCompany} />
      ))}
    </div>
  )
}
