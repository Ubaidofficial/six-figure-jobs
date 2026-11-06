// Hosted auto-apply settings. Two switches, both off by default:
//   AUTO_APPLY_ENABLED=true  (with accounts on) shows the feature: prepare, review, approve.
//   AUTO_APPLY_LIVE=true     lets the worker really submit. Without it the worker only fills the form and stops (dry run).
// The price is a product decision, so it comes from env; the default is a placeholder.

import { accountsEnabled } from '@/lib/accounts/enabled'

type Env = Record<string, string | undefined>

export const autoApplyEnabled = (env: Env = process.env) => accountsEnabled(env) && env.AUTO_APPLY_ENABLED === 'true'
export const autoApplyLive = (env: Env = process.env) => autoApplyEnabled(env) && env.AUTO_APPLY_LIVE === 'true'

/** PLACEHOLDER: credits one confirmed application costs when AUTO_APPLY_CREDITS is unset. The owner sets the real number. */
export const PLACEHOLDER_AUTO_APPLY_CREDITS = 5

export function getAutoApplyCredits(env: Env = process.env): number {
  const n = Number(env.AUTO_APPLY_CREDITS)
  return Number.isInteger(n) && n > 0 && n <= 1000 ? n : PLACEHOLDER_AUTO_APPLY_CREDITS
}

/** Applications one user can have submitted or running in a day: a floor on how fast an account can fire at employers. */
export const MAX_APPLICATIONS_PER_USER_PER_DAY = 10
/** Applications the worker sends to one employer's board per hour, whoever asks. */
export const MAX_PER_BOARD_PER_HOUR = 5
