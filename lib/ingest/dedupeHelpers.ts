// lib/ingest/dedupeHelpers.ts
// Helpers for job deduplication
//
// The dedupe key is a deterministic string that identifies "the same job"
// across different sources. Format: "companyId::normalizedTitle::normalizedLocation"
//
// IMPORTANT: We do NOT strip seniority (Senior, Staff, Lead, etc.) from titles
// because "Senior ML Engineer" and "ML Engineer" are DIFFERENT jobs.
// We only normalize formatting, not semantic content.

// =============================================================================
// Title Normalization
// =============================================================================

/**
 * Normalize job title for deduplication.
 * 
 * What we DO normalize:
 * - Case (lowercase)
 * - Whitespace and punctuation
 * - Work-mode indicators (remote, hybrid, onsite) - these don't define the role
 * - Common abbreviations (Sr. → senior, Jr. → junior)
 * 
 * What we DO NOT normalize (to preserve distinct roles):
 * - Seniority levels (Senior, Staff, Principal, Lead, Junior, Intern)
 * - Team/department indicators
 * - Specializations
 */
export function normalizeTitle(title: string): string {
  if (!title) return ''

  return title
    .toLowerCase()
    // Remove work-mode indicators (don't define the role itself)
    .replace(/\b(remote|hybrid|onsite|on-site|work from home|wfh)\b/gi, '')
    // Normalize common abbreviations to full form for consistent matching
    .replace(/\bsr\.\s*/gi, 'senior ')
    .replace(/\bjr\.\s*/gi, 'junior ')
    .replace(/\beng\.\s*/gi, 'engineer ')
    .replace(/\bmgr\.\s*/gi, 'manager ')
    .replace(/\bdev\b/gi, 'developer')
    // Remove special characters but keep alphanumeric
    .replace(/[^a-z0-9]+/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

// =============================================================================
// Location Normalization
// =============================================================================

/**
 * Normalize location for deduplication.
 * 
 * Removes generic "remote" indicators since most jobs on our board are remote.
 * Keeps specific location info (country, city, region) for matching.
 */
export function normalizeLocation(loc: string | null | undefined): string {
  if (!loc) return ''

  return loc
    .toLowerCase()
    // Remove generic remote indicators
    .replace(/\b(remote|anywhere|worldwide|global|work from home|wfh)\b/gi, '')
    // Remove common separators and punctuation
    .replace(/[^a-z0-9]+/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim()
}

// =============================================================================
// Dedupe Key Generation
// =============================================================================

/**
 * Create a deterministic dedupe key for a job.
 * 
 * Format: "companyId::normalizedTitle::normalizedLocation"
 * 
 * Two jobs with the same dedupe key are considered "the same job" and
 * will be deduplicated based on source priority.
 * 
 * @param companyId - The company's database ID
 * @param title - Raw job title
 * @param location - Raw location string (optional)
 */
export function makeJobDedupeKey(
  companyId: string,
  title: string,
  location: string | null | undefined
): string {
  const normTitle = normalizeTitle(title)
  const normLoc = normalizeLocation(location)

  // Use :: as separator (unlikely to appear in normalized strings)
  return `${companyId}::${normTitle}::${normLoc}`
}

// =============================================================================
// URL Normalization (for matching by URL)
// =============================================================================

/**
 * Normalize a URL for comparison.
 * Removes protocol, www, trailing slashes, and query params.
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    
    // Get hostname without www
    const host = parsed.hostname.replace(/^www\./, '')
    
    // Get pathname without trailing slash
    const path = parsed.pathname.replace(/\/$/, '')
    
    return `${host}${path}`.toLowerCase()
  } catch {
    // If URL parsing fails, do basic normalization
    return url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/$/, '')
      .replace(/\?.*$/, '')
  }
}

/**
 * Check if two URLs point to the same resource.
 */
export function urlsMatch(urlA: string | null | undefined, urlB: string | null | undefined): boolean {
  const normA = normalizeUrl(urlA)
  const normB = normalizeUrl(urlB)
  
  if (!normA || !normB) return false
  
  return normA === normB
}

// =============================================================================
// Debugging Helpers
// =============================================================================

/**
 * Parse a dedupe key back into its components (for debugging).
 */
export function parseDedupeKey(key: string): {
  companyId: string
  normalizedTitle: string
  normalizedLocation: string
} {
  const parts = key.split('::')
  return {
    companyId: parts[0] || '',
    normalizedTitle: parts[1] || '',
    normalizedLocation: parts[2] || '',
  }
}

/**
 * Debug helper: show what a job's dedupe key would be.
 */
export function debugDedupeKey(
  companyId: string,
  title: string,
  location: string | null | undefined
): void {
  console.log('--- Dedupe Key Debug ---')
  console.log('Input:')
  console.log('  companyId:', companyId)
  console.log('  title:', title)
  console.log('  location:', location)
  console.log('Normalized:')
  console.log('  title:', normalizeTitle(title))
  console.log('  location:', normalizeLocation(location))
  console.log('Key:', makeJobDedupeKey(companyId, title, location))
  console.log('------------------------')
}