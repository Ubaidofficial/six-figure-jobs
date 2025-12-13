// lib/roles/slugMatcher.ts
// Fuzzy matching for redirecting bad slugs to canonical slugs

import {
  CANONICAL_ROLE_SLUGS,
  CANONICAL_ROLE_SET,
  CanonicalRoleSlug,
} from './canonicalSlugs'

// ═══════════════════════════════════════════════════════════════════════════
// KEYWORD TO CANONICAL SLUG MAPPING
// ═══════════════════════════════════════════════════════════════════════════

const ROLE_KEYWORD_MAP: Record<string, CanonicalRoleSlug> = {
  // Abbreviations
  swe: 'software-engineer',
  sde: 'software-engineer',
  fe: 'frontend-engineer',
  be: 'backend-engineer',
  fs: 'full-stack-engineer',
  fullstack: 'full-stack-engineer',
  devops: 'devops-engineer',
  sre: 'site-reliability-engineer',
  ml: 'machine-learning-engineer',
  ai: 'ai-engineer',
  pm: 'product-manager',
  tpm: 'technical-program-manager',
  em: 'engineering-manager',
  ux: 'ux-designer',
  ui: 'ui-designer',
  ae: 'account-executive',
  csm: 'customer-success-manager',
  qa: 'qa-engineer',

  // Common variations
  developer: 'software-engineer',
  programmer: 'software-engineer',
  coder: 'software-engineer',
  frontend: 'frontend-engineer',
  backend: 'backend-engineer',
  'front-end': 'frontend-engineer',
  'back-end': 'backend-engineer',
  data: 'data-engineer',
  designer: 'product-designer',
  analyst: 'data-analyst',
  scientist: 'data-scientist',
  architect: 'software-architect',
  recruiter: 'recruiter',
  marketer: 'marketing-manager',
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN MATCHING FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Find the best matching canonical role slug for a bad/non-canonical slug
 * Returns null if no reasonable match can be found
 */
export function findBestMatchingRole(badSlug: string): CanonicalRoleSlug | null {
  if (!badSlug) return null

  const slug = badSlug.toLowerCase().trim()

  // 1. Direct match - already canonical
  if (CANONICAL_ROLE_SET.has(slug)) {
    return slug as CanonicalRoleSlug
  }

  // 2. Direct keyword map lookup
  if (ROLE_KEYWORD_MAP[slug]) {
    return ROLE_KEYWORD_MAP[slug]
  }

  // 3. Check if any canonical slug is a substring of the bad slug
  // Sort by length descending to match longest first (more specific)
  const sortedSlugs = [...CANONICAL_ROLE_SLUGS].sort(
    (a, b) => b.length - a.length
  )

  for (const canonical of sortedSlugs) {
    if (slug.includes(canonical)) {
      return canonical
    }
  }

  // 4. Word-level matching with seniority detection
  const words = slug.split('-')
  const hasSenior = words.includes('senior') || words.includes('sr')
  const hasStaff = words.includes('staff')
  const hasPrincipal = words.includes('principal')

  // Try to find a keyword match
  for (const word of words) {
    if (ROLE_KEYWORD_MAP[word]) {
      const baseRole = ROLE_KEYWORD_MAP[word]

      // Try to find seniority variant
      if (hasPrincipal) {
        const principalVersion = `principal-${baseRole}` as string
        if (CANONICAL_ROLE_SET.has(principalVersion)) {
          return principalVersion as CanonicalRoleSlug
        }
      }
      if (hasStaff) {
        const staffVersion = `staff-${baseRole}` as string
        if (CANONICAL_ROLE_SET.has(staffVersion)) {
          return staffVersion as CanonicalRoleSlug
        }
      }
      if (hasSenior) {
        const seniorVersion = `senior-${baseRole}` as string
        if (CANONICAL_ROLE_SET.has(seniorVersion)) {
          return seniorVersion as CanonicalRoleSlug
        }
      }

      // Return base role
      return baseRole
    }
  }

  // 5. Catch-all patterns
  if (slug.includes('engineer') && !slug.includes('manager')) {
    if (hasSenior) return 'senior-software-engineer'
    return 'software-engineer'
  }

  if (slug.includes('designer') && !slug.includes('manager')) {
    if (hasSenior) return 'senior-product-designer'
    return 'product-designer'
  }

  if (slug.includes('manager') && slug.includes('product')) {
    if (hasSenior) return 'senior-product-manager'
    return 'product-manager'
  }

  if (slug.includes('analyst')) {
    if (slug.includes('data') || slug.includes('business')) {
      return 'data-analyst'
    }
  }

  // 6. No match found - return null (will 404)
  return null
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Convert a slug to a human-readable label
 * e.g., "software-engineer" -> "Software Engineer"
 */
export function slugToLabel(slug: string): string {
  const specialCases: Record<string, string> = {
    ui: 'UI',
    ux: 'UX',
    qa: 'QA',
    ai: 'AI',
    ml: 'ML',
    bi: 'BI',
    vp: 'VP',
    svp: 'SVP',
    cto: 'CTO',
    ceo: 'CEO',
    cfo: 'CFO',
    cmo: 'CMO',
    cpo: 'CPO',
    coo: 'COO',
    ciso: 'CISO',
    api: 'API',
    nlp: 'NLP',
    ios: 'iOS',
    sre: 'SRE',
    hr: 'HR',
    seo: 'SEO',
  }

  return slug
    .split('-')
    .map((word) => {
      const lower = word.toLowerCase()
      return specialCases[lower] || word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}

/**
 * Convert a label to a slug
 * e.g., "Software Engineer" -> "software-engineer"
 */
export function labelToSlug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
