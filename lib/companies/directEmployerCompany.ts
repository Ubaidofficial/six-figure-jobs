// lib/companies/directEmployerCompany.ts
// How a direct employer (lib/constants/directEmployers.ts) updates its company row on each sync.
import type { DirectEmployer } from '../constants/directEmployers'

/** "https://www.Scale.com/careers" -> "scale.com"; null when it is not a URL. */
function domainOf(website: string | null): string | null {
  if (!website) return null
  try {
    return new URL(website.includes('://') ? website : `https://${website}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * ATS fields kept current. The employer's checked domain becomes its website, so its logo is looked up by domain
 * rather than by name (a name can match another company's logo). It replaces a website on another domain: Scale AI and
 * Relativity Space had websites guessed from their slugs ("scale-ai.com", "relativity-space.com"), which kept their
 * logos as letters after the 2026-11-10 sync. A stored logo.dev logo for some other domain is dropped for the same
 * reason: buildLogoUrl prefers it to the website, and logo.dev draws a letter for a domain it does not know.
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
    if (domainOf(existing.website) !== e.website) data.website = `https://${e.website}`
    const logoDomain = existing.logoUrl?.match(/^https:\/\/img\.logo\.dev\/([^/?#]+)/)?.[1]?.toLowerCase()
    if (logoDomain && logoDomain !== 'name' && logoDomain !== e.website) data.logoUrl = null
  }
  return data
}
