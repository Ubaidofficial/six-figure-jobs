import Link from 'next/link'

import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { JobCard } from '@/components/jobs/JobCard'

import styles from './LatestOpportunities.module.css'

const MAX_PER_COMPANY = 2

function dedupeLatest(jobs: JobWithCompany[], limit: number): JobWithCompany[] {
  const result: JobWithCompany[] = []
  const seen = new Set<string>()
  const perCompany = new Map<string, number>()

  for (const job of jobs) {
    const companyId = (job as any).companyId || job.companyRef?.id || ''
    const title = (job.title || '').trim().toLowerCase()
    const min = String((job as any).minAnnual ?? '')
    const max = String((job as any).maxAnnual ?? '')
    const key = `${companyId}:${title}:${min}:${max}`
    if (seen.has(key)) continue
    // One employer must not fill the whole list (a bulk import can post dozens at once).
    if ((perCompany.get(companyId) ?? 0) >= MAX_PER_COMPANY) continue
    seen.add(key)
    perCompany.set(companyId, (perCompany.get(companyId) ?? 0) + 1)
    result.push(job)
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
