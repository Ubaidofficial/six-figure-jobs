// lib/companies/websiteCorrections.ts
// Companies whose stored website is wrong, with their real domain. Applied by scripts/remediate-data-quality.ts, which
// runs after every sync, so a fix lands without a manual database edit.
//
// Found by the 2026-11-10 check of every tile on /companies and /remote/companies against logo.dev. The old seed script
// guessed websites from slugs ("grafana-labs.com", "ashby.com"), and logo.dev draws a letter for a domain it does not
// know, or another company's logo for a domain someone else owns ("kong.com", "carrot.com"). The last four had no
// website, and logo.dev found no logo for their names. Each domain was checked against the site's own homepage title.

/** Company slug -> its real domain. */
export const COMPANY_WEBSITE_CORRECTIONS: Record<string, string> = {
  'grafana-labs': 'grafana.com',
  ashby: 'ashbyhq.com',
  kong: 'konghq.com',
  'spring-health': 'springhealth.com',
  carrot: 'get-carrot.com', // Carrot Fertility
  turnertownsend: 'turnerandtownsend.com',
  clearstreet: 'clearstreet.io',
  'zoominfo-technologies-llc': 'zoominfo.com',
  empleora: 'empleora.com',
}

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
 * The checked domain becomes the website, so the logo is looked up by domain rather than by name (a name can match
 * another company's logo). A stored logo.dev logo for some other domain is dropped: buildLogoUrl prefers it to the
 * website, and logo.dev draws a letter for a domain it does not know.
 */
export function websiteUpdatesFor(domain: string, existing: { website: string | null; logoUrl: string | null }) {
  const data: { website?: string; logoUrl?: null } = {}
  if (domainOf(existing.website) !== domain) data.website = `https://${domain}`
  const logoDomain = existing.logoUrl?.match(/^https:\/\/img\.logo\.dev\/([^/?#]+)/)?.[1]?.toLowerCase()
  if (logoDomain && logoDomain !== 'name' && logoDomain !== domain) data.logoUrl = null
  return data
}
