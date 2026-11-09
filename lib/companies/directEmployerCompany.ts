// lib/companies/directEmployerCompany.ts
// How a direct employer (lib/constants/directEmployers.ts) updates its company row on each sync.
import type { DirectEmployer } from '../constants/directEmployers'

/**
 * ATS fields kept current. The employer's domain fills a missing website, so its logo is looked up by domain rather
 * than by name (a name can match another company's logo). A stored logo.dev logo for some other domain ("scale-ai.com", guessed from a slug)
 * is dropped: buildLogoUrl prefers it to the website, and logo.dev draws a letter for a domain it does not know.
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
  if (e.website) {
    if (!existing.website) data.website = `https://${e.website}`
    const logoDomain = existing.logoUrl?.match(/^https:\/\/img\.logo\.dev\/([^/?#]+)/)?.[1]?.toLowerCase()
    if (logoDomain && logoDomain !== 'name' && logoDomain !== e.website) data.logoUrl = null
  }
  return data
}
