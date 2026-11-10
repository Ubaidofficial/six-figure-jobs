// Server side of the alert signup: renders nothing while alerts are off, and builds the alert's name from the page's
// job query so the visitor sees exactly what they will get.
import { alertsEnabled } from '@/lib/alerts/config'
import { buildAlertLabel, sanitizeAlertFilters } from '@/lib/alerts/filters'
import type { JobQueryInput } from '@/lib/jobs/queryJobs'

import { JobAlertSignup } from './JobAlertSignup'

export function JobAlertBox({ query, variant }: { query: JobQueryInput; variant?: 'inline' | 'footer' }) {
  if (!alertsEnabled()) return null
  const filters = sanitizeAlertFilters(query) ?? {}
  return <JobAlertSignup filters={filters} label={buildAlertLabel(filters)} variant={variant} />
}
