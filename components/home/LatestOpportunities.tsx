import Link from 'next/link'

import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { JobRow, JobRowList } from '@/components/jobs/JobRow'
import { dedupeLatest } from '@/lib/jobs/latestSelection'

import styles from './LatestOpportunities.module.css'
import { toPublicJob } from '@/lib/jobs/publicJob'
import { SectionHeading } from '@/components/ui/SectionHeading'

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
          <SectionHeading eyebrow="Latest jobs" light="Latest" strong="Six Figure Opportunities" />
        </div>
        <Link href="/jobs" className={`arrow-link ${styles.headerLink}`}>
          <span className="arrow-link-label">Explore all opportunities</span>
          <span className="arrow-chip" aria-hidden="true">&#8599;</span>
        </Link>
      </header>

      {latest.length === 0 ? (
        <div className={styles.empty}>
          <p>No jobs found. Try adjusting your filters or explore all six-figure opportunities.</p>
        </div>
      ) : (
        <JobRowList reveal="stagger">
          {latest.map(toPublicJob).map((job) => (
            <JobRow key={job.id} job={job} />
          ))}
        </JobRowList>
      )}

      <div className={styles.cta}>
        <Link href="/jobs" className={styles.ctaButton}>
          Explore all {totalJobs.toLocaleString()} opportunities <span aria-hidden="true">→</span>
        </Link>
      </div>
    </section>
  )
}
