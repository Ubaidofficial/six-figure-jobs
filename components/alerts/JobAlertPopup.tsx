// Server side of the alert popup: renders nothing while alerts are off (same switch as every other alert form), and builds
// the alert's name on the server. The popup is for all jobs; the inline box above a listing is for that listing's search.
import { alertsEnabled } from '@/lib/alerts/config'
import { buildAlertLabel } from '@/lib/alerts/filters'

import { JobAlertPopupClient } from './JobAlertPopupClient'

export function JobAlertPopup() {
  if (!alertsEnabled()) return null
  return <JobAlertPopupClient label={buildAlertLabel({})} />
}
