// lib/navigation/internalLinks.ts
import type { JobSlice } from '../slices/types'
import { countryCodeToSlug } from '../seo/countrySlug'

export type InternalLink = {
  href: string
  label: string
  description?: string
}

const SALARY_BANDS = [100_000, 200_000, 300_000, 400_000]

function countryNameFromCode(code?: string): string {
  if (!code) return ''
  const upper = code.toUpperCase()
  const map: Record<string, string> = {
    US: 'United States',
    CA: 'Canada',
    GB: 'United Kingdom',
    DE: 'Germany',
    ES: 'Spain',
    IE: 'Ireland',
  }
  return map[upper] ?? upper
}

function humanize(str: string = ''): string {
  return str
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Build internal links to related slices:
 *  - other salary bands for the same role+country
 *  - country-wide slice for all roles
 */
export function buildSliceInternalLinks(slice: JobSlice): InternalLink[] {
  const links: InternalLink[] = []
  const f = slice.filters

  const roleSlug = f.roleSlugs?.[0]
  const role = roleSlug ? humanize(roleSlug) : null
  const countryCode = f.countryCode
  const country = countryCode ? countryNameFromCode(countryCode) : null
  const countrySlug = countryCode ? countryCodeToSlug(countryCode) : null

  // If we have salary + role + country, suggest other salary bands
  if (roleSlug && countryCode && f.minAnnual) {
    for (const band of SALARY_BANDS) {
      if (band === f.minAnnual) continue
      const bandSlug = `${band / 1000}k-plus`
      const href = `/jobs/${bandSlug}/${roleSlug}/${countrySlug}`
      links.push({
        href,
        label: `${Math.round(band / 1000)}k+ ${role} jobs in ${country}`,
      })
    }
  }

  // If we have salary + country, suggest "all roles in country"
  if (countryCode && f.minAnnual) {
    const bandSlug = `${f.minAnnual / 1000}k-plus`
    const href = `/jobs/${bandSlug}/all-roles/${countrySlug}`
    links.push({
      href,
      label: `${Math.round(f.minAnnual / 1000)}k+ jobs in ${country}`,
    })
  }

  return links
}
