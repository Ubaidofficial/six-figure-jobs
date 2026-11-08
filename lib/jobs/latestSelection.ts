// lib/jobs/latestSelection.ts
// Which jobs the homepage "Latest Six Figure Opportunities" list shows: newest first, but varied by employer and
// market, the way the big remote boards balance their front page across categories.
import { inferCountryFromJob } from '../seo/jobJsonLd'
import type { JobWithCompany } from './queryJobs'

const MAX_PER_COMPANY = 2
// One market must not fill the list either: a bulk import from one country (2026-11 freehire Swiss jobs) made the
// newest-first list almost all Swiss. Remote jobs count as their own market.
const MAX_PER_MARKET = 3

// German-language postings mark the genders in the title: "Facharzt (m/w/d)", "Controller (w/m/d)". English "(m/f/d)"
// postings are not matched (no "w").
const GERMAN_GENDER_TAG = /\(\s*(?:[mfdx]\s*\/\s*)*w(?:\s*\/\s*[mwfdx])+\s*\)/i

/**
 * Jobs the homepage lists first (owner's decision, 2026-11-08): an English posting with a real role. German doctor and
 * construction ads (role "other", "(m/w/d)" titles) had filled the newest-first lists; they still show, after these.
 */
export function isHomepageFeatured(job: Pick<JobWithCompany, 'title'> & { roleSlug?: string | null }): boolean {
  return Boolean(job.roleSlug) && job.roleSlug !== 'other' && !GERMAN_GENDER_TAG.test(job.title ?? '')
}

function marketOf(job: JobWithCompany): string {
  if ((job as any).remote === true || (job as any).remoteMode === 'remote') return 'remote'
  // Many imported jobs have no countryCode ("Hamburg, Hamburg", "Chicago, Cook County"). Use the same inference as the job
  // page's JSON-LD (stored code, then location text, city, currency), so they count toward their country's cap instead of
  // a separate "unknown" bucket.
  return String(inferCountryFromJob(job) || 'unknown').toUpperCase()
}

/**
 * The newest jobs, at most MAX_PER_COMPANY per employer and MAX_PER_MARKET per market, still newest first. When the
 * newest jobs are too uniform to fill the list, a second pass fills the rest with the next newest, so it is never short.
 */
export function dedupeLatest(jobs: JobWithCompany[], limit: number): JobWithCompany[] {
  const seen = new Set<string>()
  const unique: JobWithCompany[] = []
  for (const job of jobs) {
    const companyId = (job as any).companyId || job.companyRef?.id || ''
    const title = (job.title || '').trim().toLowerCase()
    const min = String((job as any).minAnnual ?? '')
    const max = String((job as any).maxAnnual ?? '')
    const key = `${companyId}:${title}:${min}:${max}`
    if (seen.has(key)) continue
    seen.add(key)
    unique.push(job)
  }

  const picked = new Set<JobWithCompany>()
  const perCompany = new Map<string, number>()
  const perMarket = new Map<string, number>()
  const take = (job: JobWithCompany) => {
    const companyId = (job as any).companyId || job.companyRef?.id || ''
    picked.add(job)
    perCompany.set(companyId, (perCompany.get(companyId) ?? 0) + 1)
    perMarket.set(marketOf(job), (perMarket.get(marketOf(job)) ?? 0) + 1)
  }
  // Featured jobs first, then the rest, each newest first (the final order is newest first again).
  const preferred = [...unique.filter((j) => isHomepageFeatured(j as any)), ...unique.filter((j) => !isHomepageFeatured(j as any))]
  for (const job of preferred) {
    if (picked.size >= limit) break
    const companyId = (job as any).companyId || job.companyRef?.id || ''
    if ((perCompany.get(companyId) ?? 0) >= MAX_PER_COMPANY) continue
    if ((perMarket.get(marketOf(job)) ?? 0) >= MAX_PER_MARKET) continue
    take(job)
  }
  // Too uniform to fill the list: keep the employer cap, drop the market cap.
  for (const job of unique) {
    if (picked.size >= limit) break
    if (picked.has(job)) continue
    const companyId = (job as any).companyId || job.companyRef?.id || ''
    if ((perCompany.get(companyId) ?? 0) >= MAX_PER_COMPANY) continue
    take(job)
  }
  // Featured picks first, then the fill, each newest first. Sorting all of them by date put newer German agency ads,
  // taken only to fill the list, back on top (seen live after the change, 2026-11-08).
  const featured = (job: JobWithCompany) => isHomepageFeatured(job as any)
  return [...unique.filter((job) => picked.has(job) && featured(job)), ...unique.filter((job) => picked.has(job) && !featured(job))]
}
