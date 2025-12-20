import Link from 'next/link'

import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import JobCard, { type JobCardJob } from '@/app/components/JobCard'

import styles from './LatestOpportunities.module.css'

function dedupeLatest(jobs: JobWithCompany[], limit: number): JobCardJob[] {
  const result: JobCardJob[] = []
  const seen = new Set<string>()

  for (const job of jobs) {
    const companyId = (job as any).companyId || job.companyRef?.id || ''
    const title = (job.title || '').trim().toLowerCase()
    const min = String((job as any).minAnnual ?? '')
    const max = String((job as any).maxAnnual ?? '')
    const key = `${companyId}:${title}:${min}:${max}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(job as JobCardJob)
    if (result.length >= limit) break
  }

  return result
}

export function LatestOpportunities({
  jobs,
  totalJobs,
}: {
  jobs: JobWithCompany[]
  totalJobs: number
}) {
  const latest = dedupeLatest(jobs, 6)

  return (
    <section className={styles.section} aria-label="Latest opportunities">
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Latest $100k+ Opportunities (Minimum Salary)</h2>
        </div>
        <Link href="/jobs" className={styles.headerLink}>
          Explore all opportunities <span aria-hidden="true">→</span>
        </Link>
      </header>

      {latest.length === 0 ? (
        <div className={styles.empty}>
          <p>No jobs found. Try adjusting your filters or explore all $100k+ opportunities.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {latest.map((job) => (
            <JobCard key={job.id} job={job} variant="compact" />
          ))}
        </div>
      )}

      <div className={styles.cta}>
        <Link href="/jobs" className={styles.ctaButton}>
          Explore all {totalJobs.toLocaleString()} opportunities <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}
