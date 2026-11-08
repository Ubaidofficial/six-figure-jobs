import Link from 'next/link'

import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { JobCard } from '@/components/jobs/JobCard'
import { dedupeLatest } from '@/lib/jobs/latestSelection'

import styles from './LatestOpportunities.module.css'

export function LatestOpportunities({
  jobs,
  totalJobs,
}: {
  jobs: JobWithCompany[]
  totalJobs: number
}) {
  const latest = dedupeLatest(jobs, 10)

  return (
    <section className={styles.section} aria-label="Latest opportunities">
      <header className={styles.header}>
        <div>
          <h2 className={styles.title}>Latest Six Figure Opportunities</h2>
        </div>
        <Link href="/jobs" className={styles.headerLink}>
          Explore all opportunities <span aria-hidden="true">→</span>
        </Link>
      </header>

      {latest.length === 0 ? (
        <div className={styles.empty}>
          <p>No jobs found. Try adjusting your filters or explore all six-figure opportunities.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {latest.map((job) => (
            <JobCard key={job.id} job={job} variant="homepage" className="reveal-on-scroll" />
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
