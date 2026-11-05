// lib/seo/pseoUnlock.ts
//
// Data-driven unlock of programmatic (pSEO) pages during the Phase 1 rollout.
//
// Phase 1 (lib/seo/indexingPhase.ts) deliberately keeps most page types noindex so a low-authority site is not
// flooded with thin URLs. But that rule is blunt: /jobs/skills/python (hundreds of live $100k+ jobs) was noindex
// while a 1-job combo was not. This module lets a page whose live job count is clearly substantial index itself
// without waiting for a global phase bump. Page metadata and the sitemap call the SAME functions, so a URL is
// advertised if and only if the page serves `index, follow`.
//
// Tuning (env, read at call time):
//   PSEO_UNLOCK=0              turn the unlock off entirely (back to pure phase gating)
//   PSEO_HUB_MIN_JOBS=<n>      min live jobs for skill / city / level hubs (default 25)
//   PSEO_ROLE_MIN_JOBS=<n>     min live jobs for roles outside the Phase 1 list, e.g. senior-software-engineer (default 10)

export const PSEO_DEFAULT_HUB_MIN_JOBS = 25
export const PSEO_DEFAULT_ROLE_MIN_JOBS = 10

// Role × skill and role × city pages are indexable from this many jobs (their own page gate), but only advertised
// in the sitemap from the higher number, so the sitemap carries the strongest combinations first.
export const PSEO_COMBO_MIN_JOBS = 5
export const PSEO_COMBO_SITEMAP_MIN_JOBS = 10

function readPositiveInt(value: string | undefined, fallback: number): number {
  const n = Number.parseInt(String(value ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : fallback
}

export function isPseoUnlockEnabled(): boolean {
  return process.env.PSEO_UNLOCK !== '0'
}

export function getPseoHubMinJobs(): number {
  return readPositiveInt(process.env.PSEO_HUB_MIN_JOBS, PSEO_DEFAULT_HUB_MIN_JOBS)
}

export function getPseoRoleMinJobs(): number {
  return readPositiveInt(process.env.PSEO_ROLE_MIN_JOBS, PSEO_DEFAULT_ROLE_MIN_JOBS)
}

function toCount(value: number | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/** Skill, city and level hubs: indexable once they list a substantial number of live $100k+ jobs. */
export function isPseoHubUnlocked(liveJobCount: number | null | undefined): boolean {
  return isPseoUnlockEnabled() && toCount(liveJobCount) >= getPseoHubMinJobs()
}

/** Tier-1 role pages that are not in the Phase 1 list (senior/staff variants, SRE, solutions architect…). */
export function isPseoRoleUnlocked(liveJobCount: number | null | undefined): boolean {
  return isPseoUnlockEnabled() && toCount(liveJobCount) >= getPseoRoleMinJobs()
}
