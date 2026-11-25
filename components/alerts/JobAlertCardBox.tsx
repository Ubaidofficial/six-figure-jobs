// Server side of the job page's alert card (JobAlertCard.tsx): renders nothing while alerts are off (the same switch as
// every alert form), builds the alert from the job (its role, else title words, and its country, as the page's "jobs
// like this" box does) and counts the matching jobs posted in the last 7 days for the headline. The count is kept 10
// minutes per role and country; a failed count only drops the number from the headline.
import { alertQueryInput, buildAlertLabel, sanitizeAlertFilters } from '@/lib/alerts/filters'
import { alertsEnabled } from '@/lib/alerts/config'
import { memoAsync, stableKey } from '@/lib/cache/memo'
import { buildFreshJobWhere } from '@/lib/jobs/freshness'
import { buildWhere, type JobQueryInput } from '@/lib/jobs/queryJobs'
import { prisma } from '@/lib/prisma'

import { JobAlertCard } from './JobAlertCard'

export async function JobAlertCardBox({ query }: { query: JobQueryInput }) {
  if (!alertsEnabled()) return null
  const filters = sanitizeAlertFilters(query) ?? {}
  let newThisWeek: number | null = null
  try {
    newThisWeek = await memoAsync(stableKey('job-alert-card-week', filters), 10 * 60_000, () =>
      prisma.job.count({ where: { AND: [buildWhere(alertQueryInput(filters)), buildFreshJobWhere(7)] } }),
    )
  } catch {
    newThisWeek = null
  }
  return <JobAlertCard filters={filters} label={buildAlertLabel(filters)} newThisWeek={newThisWeek} />
}
