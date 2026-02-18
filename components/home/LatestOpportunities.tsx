import Image from 'next/image'
import Link from 'next/link'

import type { JobWithCompany } from '@/lib/jobs/queryJobs'
import { buildJobSlugHref } from '@/lib/jobs/jobSlug'
import { buildSalaryText } from '@/lib/jobs/salary'
import { formatRelativeTime } from '@/lib/utils/time'
import { buildLogoUrl } from '@/lib/companies/logo'

import styles from './LatestOpportunities.module.css'

function dedupeLatest(jobs: JobWithCompany[], limit: number): JobWithCompany[] {
  const result: JobWithCompany[] = []
  const seen = new Set<string>()

  for (const job of jobs) {
    const companyId = (job as any).companyId || job.companyRef?.id || ''
    const title = (job.title || '').trim().toLowerCase()
    const min = String((job as any).minAnnual ?? '')
    const max = String((job as any).maxAnnual ?? '')
    const key = `${companyId}:${title}:${min}:${max}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(job)
    if (result.length >= limit) break
  }

  return result
}

function getCompanyName(job: JobWithCompany): string {
  return job.companyRef?.name ?? job.company ?? 'Unknown company'
}

function getLocationLabel(job: JobWithCompany): string | null {
  const primary = typeof job.primaryLocation === 'string' ? job.primaryLocation.trim() : ''
  if (primary) return primary

  if (job.city && job.countryCode) return `${job.city}, ${job.countryCode}`
  if (typeof job.locationRaw === 'string' && job.locationRaw.trim()) return job.locationRaw.trim()

  if (job.remote === true || job.remoteMode === 'remote') return 'Remote'
  if (job.countryCode) return job.countryCode

  return null
}

function initialsFromName(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()
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
          {latest.map((job) => {
            const companyName = getCompanyName(job)
            const location = getLocationLabel(job)
            const salary = buildSalaryText(job)
            const posted = formatRelativeTime(job.postedAt ?? job.createdAt ?? job.updatedAt ?? null)
            const logoUrl = buildLogoUrl(
              job.companyRef?.logoUrl ?? job.companyLogo ?? null,
              job.companyRef?.website ?? null,
            )

            return (
              <article
                key={job.id}
                className="group rounded-2xl border border-slate-800 bg-slate-950/50 p-4 shadow-sm transition hover:border-slate-700 hover:bg-slate-950/70"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-900 text-xs font-semibold text-slate-300">
                    {logoUrl ? (
                      <Image
                        src={logoUrl}
                        alt={`${companyName} logo`}
                        width={48}
                        height={48}
                        className="h-full w-full object-contain"
                      />
                    ) : (
                      initialsFromName(companyName)
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-1 text-base font-semibold text-slate-100">
                      <Link href={buildJobSlugHref(job)} className="hover:text-white hover:underline">
                        {job.title}
                      </Link>
                    </h3>
                    <p className="mt-0.5 line-clamp-1 text-sm text-slate-400">{companyName}</p>
                  </div>

                  {salary ? (
                    <span className="shrink-0 rounded-full border border-emerald-400/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                      {salary}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                  {location ? <span>📍 {location}</span> : null}
                  {posted ? <span>⏱ Posted {posted}</span> : null}
                </div>
              </article>
            )
          })}
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
