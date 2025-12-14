// lib/normalizers/role.ts

import { isCanonicalSlug } from '../roles/canonicalSlugs'

export type Seniority =
  | 'intern'
  | 'junior'
  | 'mid'
  | 'senior'
  | 'staff'
  | 'principal'
  | 'lead'
  | 'manager'
  | 'director'
  | 'vp'
  | 'cxo'
  | 'head'
  | 'unknown'

export type Discipline =
  | 'engineering'
  | 'data'
  | 'design'
  | 'product'
  | 'marketing'
  | 'sales'
  | 'operations'
  | 'people'
  | 'finance'
  | 'legal'
  | 'support'
  | 'generalist'
  | 'other'

export interface NormalizedRole {
  /** Cleaned title (no bracket junk, trimmed) */
  normalizedTitle: string

  /** slug including seniority when present, e.g. "senior-software-engineer" */
  roleSlug: string

  /** base role slug without seniority, e.g. "software-engineer" */
  baseRoleSlug: string

  /** inferred seniority */
  seniority: Seniority

  /** functional bucket */
  discipline: Discipline

  /** does this look like a managerial/people-lead role? */
  isManager: boolean
}

/**
 * High-level normalizer: turn "Sr. Staff ML Engineer (Remote, US)" into
 *   {
 *     normalizedTitle: "Staff Machine Learning Engineer",
 *     roleSlug: "staff-machine-learning-engineer",
 *     baseRoleSlug: "machine-learning-engineer",
 *     seniority: "staff",
 *     discipline: "engineering",
 *     isManager: false,
 *   }
 */
export function normalizeRole(rawTitle: string | null | undefined): NormalizedRole {
  const cleaned = cleanTitle(rawTitle)
  if (!cleaned) {
    return {
      normalizedTitle: '',
      roleSlug: '',
      baseRoleSlug: '',
      seniority: 'unknown',
      discipline: 'other',
      isManager: false,
    }
  }

  const lower = cleaned.toLowerCase()

  const seniority = inferSeniority(lower)
  const discipline = inferDiscipline(lower)
  const isManager = inferIsManager(lower)

  const baseTitle = stripSeniorityTokens(cleaned)
  const generatedBaseRoleSlug = slugify(baseTitle)
  const generatedRoleSlug = buildRoleSlug(generatedBaseRoleSlug, seniority)

  // v2.7: enforce canonical-only role slugs (prevents garbage URLs)
  const canonicalRoleSlug = isCanonicalSlug(generatedRoleSlug) ? generatedRoleSlug : ''

  // Derive canonical base role slug (remove seniority prefix when present)
  // Note: seniority "mid" and "unknown" do not prefix roleSlug.
  const canonicalBaseRoleSlug = canonicalRoleSlug
    ? canonicalRoleSlug.replace(
        /^(intern|junior|senior|staff|principal|lead|manager|director|vp|cxo|head)-/,
        '',
      )
    : ''

  return {
    normalizedTitle: capitalizeTitle(baseTitle),
    roleSlug: canonicalRoleSlug,
    baseRoleSlug: canonicalBaseRoleSlug,
    seniority,
    discipline,
    isManager,
  }
}

/* ------------------------------------------------------------------ */
/* Internals                                                          */
/* ------------------------------------------------------------------ */

function cleanTitle(raw: string | null | undefined): string {
  if (!raw) return ''
  let t = raw.trim()

  // Remove common trailing bracketed noise:
  // "(Remote)", "[Contract]", "- US only", etc.
  t = t.replace(/\s*\[[^\]]*\]\s*$/g, '')
  t = t.replace(/\s*\([^)]+\)\s*$/g, '')

  // Collapse whitespace
  t = t.replace(/\s+/g, ' ').trim()

  return t
}

function inferSeniority(lower: string): Seniority {
  // Order matters: more specific first
  if (/\bintern(ship)?\b/.test(lower)) return 'intern'
  if (/\b(principal)\b/.test(lower)) return 'principal'
  if (/\bstaff\b/.test(lower)) return 'staff'
  if (/\bsenior\b/.test(lower) || /\bsr[.\s]/.test(lower)) return 'senior'
  if (/\b(junior|jr[.\s])\b/.test(lower)) return 'junior'
  if (/\b(vp|vice president)\b/.test(lower)) return 'vp'
  if (/\b(head of|head,)\b/.test(lower)) return 'head'
  if (/\b(cto|cpo|cmo|cfo|ceo|chief )\b/.test(lower)) return 'cxo'
  if (/\bmanager\b/.test(lower)) return 'manager'
  if (/\bdirector\b/.test(lower)) return 'director'
  if (/\blead\b/.test(lower)) return 'lead'

  // Default for generic titles like "Software Engineer"
  if (/\bengineer\b/.test(lower) || /\bdeveloper\b/.test(lower)) {
    return 'mid'
  }

  return 'unknown'
}

function inferDiscipline(lower: string): Discipline {
  // Engineering
  if (
    /\b(engineer|developer|devops|sre|platform|backend|front ?end|fullstack|full-stack)\b/.test(
      lower,
    )
  ) {
    return 'engineering'
  }

  // Data
  if (
    /\b(data scientist|data science|machine learning|ml engineer|ai engineer|nlp|computer vision|analytics?|bi developer|data engineer)\b/.test(
      lower,
    )
  ) {
    return 'data'
  }

  // Design
  if (/\b(designer|ux|ui|product design|visual design|brand design)\b/.test(lower)) {
    return 'design'
  }

  // Product
  if (/\b(product manager|pm\b|product owner|product lead)\b/.test(lower)) {
    return 'product'
  }

  // Marketing / Growth
  if (
    /\b(marketing|growth|seo|sem|performance marketing|demand gen|content marketer?)\b/.test(
      lower,
    )
  ) {
    return 'marketing'
  }

  // Sales / Biz dev
  if (
    /\b(account executive|ae\b|sales|business development|bdm\b|account manager|customer success)\b/.test(
      lower,
    )
  ) {
    return 'sales'
  }

  // Operations
  if (
    /\b(operations?|ops|program manager|project manager|chief of staff|strategy)\b/.test(
      lower,
    )
  ) {
    return 'operations'
  }

  // People / HR / Talent
  if (/\b(recruiter|talent|hr|people ops|people operations|people partner)\b/.test(lower)) {
    return 'people'
  }

  // Finance
  if (/\b(finance|fp&a|controller|accountant|tax)\b/.test(lower)) {
    return 'finance'
  }

  // Legal
  if (/\b(legal|counsel|attorney|lawyer|compliance)\b/.test(lower)) {
    return 'legal'
  }

  // Support / CX
  if (/\b(support|customer support|customer experience|customer service|help desk)\b/.test(lower)) {
    return 'support'
  }

  // Very generic titles
  if (/\b(founder|co-founder|generalist)\b/.test(lower)) {
    return 'generalist'
  }

  return 'other'
}

function inferIsManager(lower: string): boolean {
  if (
    /\b(manager|lead|head of|head,|director|vp|vice president|cto|cpo|cmo|cfo|ceo|chief )\b/.test(
      lower,
    )
  ) {
    return true
  }
  return false
}

function stripSeniorityTokens(title: string): string {
  let t = title

  // Common prefixes
  t = t.replace(/^(Senior|Sr\.?|Staff|Principal|Lead|Junior|Jr\.?)\s+/i, '')

  // Also handle things like "Senior Staff Software Engineer"
  t = t.replace(/^(Senior|Sr\.?)\s+(Staff|Principal)\s+/i, '')
  t = t.replace(/^(Staff|Principal)\s+(Engineer|Developer)/i, ' $1 $2')

  return t.trim()
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function buildRoleSlug(baseRoleSlug: string, seniority: Seniority): string {
  if (!baseRoleSlug) return ''
  if (seniority === 'unknown' || seniority === 'mid') {
    return baseRoleSlug
  }
  return `${seniority}-${baseRoleSlug}`
}

function capitalizeTitle(str: string): string {
  if (!str) return ''
  return str
    .split(' ')
    .map((w) => {
      if (!w) return w
      if (w.toUpperCase() === w) return w // keep acronyms
      return w.charAt(0).toUpperCase() + w.slice(1)
    })
    .join(' ')
}
