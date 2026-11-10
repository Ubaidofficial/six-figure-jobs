// lib/companies/directEmployerCompany.ts
// How a direct employer (lib/constants/directEmployers.ts) updates its company row on each sync.
import type { DirectEmployer } from '../constants/directEmployers'
import { websiteUpdatesFor } from './websiteCorrections'

/**
 * ATS fields kept current, and the employer's checked domain applied as its website (see websiteUpdatesFor). Scale AI
 * and Relativity Space had websites guessed from their slugs ("scale-ai.com", "relativity-space.com"), which kept their
 * logos as letters after the 2026-11-10 sync.
 */
export function companyUpdatesFor(
  e: DirectEmployer,
  existing: { atsProvider: string | null; atsUrl: string | null; website: string | null; logoUrl: string | null },
) {
  const data: { atsProvider?: string; atsUrl?: string; website?: string; logoUrl?: null } = {}
  if (existing.atsProvider !== e.provider || existing.atsUrl !== e.boardUrl) {
    data.atsProvider = e.provider
    data.atsUrl = e.boardUrl
  }
  return e.website ? { ...data, ...websiteUpdatesFor(e.website, existing) } : data
}
