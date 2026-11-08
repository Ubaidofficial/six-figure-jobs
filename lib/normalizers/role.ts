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
      roleSlug: 'other',
      baseRoleSlug: 'other',
      seniority: 'unknown',
      discipline: 'other',
      isManager: false,
    }
  }

  const lower = cleaned.toLowerCase()

  // "Member of Technical Staff" is a title, not the staff level.
  const seniority = inferSeniority(lower.replace(/\bmember of (the )?technical staff\b/g, ''))
  const discipline = inferDiscipline(lower)
  const isManager = inferIsManager(lower)

  const baseTitle = stripSeniorityTokens(cleaned)
  const generatedBaseRoleSlug = slugify(baseTitle)
  const generatedRoleSlug = buildRoleSlug(generatedBaseRoleSlug, seniority)

  // v2.7: enforce canonical-only role slugs (prevents garbage URLs). When the whole title is not a canonical slug, fall
  // back to its base role ("Lead Data Engineer" → data-engineer), then to the role its words name
  // ("Senior Full-Stack Developer" → senior-full-stack-engineer). Without these ~90% of jobs were "other" (2026-11-08).
  const canonicalRoleSlug = isCanonicalSlug(generatedRoleSlug)
    ? generatedRoleSlug
    : withSeniority(isCanonicalSlug(generatedBaseRoleSlug) ? generatedBaseRoleSlug : classifyTitle(lower), seniority)

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

/** "senior" + data-engineer → senior-data-engineer when that page exists, else the base role; no role page → "other". */
function withSeniority(base: string | null, seniority: Seniority): string {
  if (!base || !isCanonicalSlug(base)) return 'other'
  const prefixed = `${seniority}-${base}`
  return ['junior', 'senior', 'staff', 'principal', 'lead'].includes(seniority) && isCanonicalSlug(prefixed) ? prefixed : base
}

// Title words → canonical base role, first match wins. Leadership and manager titles only map to leadership and manager
// roles, so "Director, Data Analytics" is not filed as a data analyst. Only roles with a page are listed; titles outside
// them (physicians, attorneys at law firms, construction, hardware engineering) stay "other".
const LEADERSHIP_RULES: Array<[RegExp, string]> = [
  [/\bchief financial officer\b/, 'cfo'],
  [/\bchief technology officer\b/, 'cto'],
  [/\bchief executive officer\b/, 'ceo'],
  [/\bchief marketing officer\b/, 'cmo'],
  [/\bchief operating officer\b/, 'chief-operating-officer'],
  [/\bchief information security officer\b/, 'ciso'],
  [/\bengineering\b|\bsoftware\b|\btechnology\b/, 'engineering-director'],
  [/\bmarketing\b/, 'marketing-director'],
  [/\bsales\b/, 'sales-director'],
  [/\bfinance\b|\bfinancial\b|\bcontrolling\b/, 'finance-director'],
  [/\bcustomer success\b/, 'customer-success-director'],
  [/\bcompliance\b/, 'compliance-director'],
  [/\bcreative\b/, 'creative-director'],
  [/\b(hr|human resources|people)\b/, 'hr-director'],
  [/\boperations\b/, 'operations-director'],
]
const MANAGER_RULES: Array<[RegExp, string]> = [
  [/\btechnical program manager\b|\btpm\b/, 'technical-program-manager'],
  [/\bengineering manager\b|\bmanager,? (software )?engineering\b|\bsoftware development manager\b/, 'engineering-manager'],
  [/\bproduct marketing\b/, 'product-marketing-manager'],
  [/\bgroup product manager\b/, 'group-product-manager'],
  [/\bproduct (manager|management|owner)\b/, 'product-manager'],
  [/\bprogram manager\b/, 'program-manager'],
  [/\bproje[ck]t ?(manager|leiter|lead)/, 'project-manager'],
  [/\bcustomer success\b/, 'customer-success-manager'],
  [/\baccount manag/, 'account-manager'],
  [/\bbusiness development\b/, 'business-development-manager'],
  [/\bsales manager\b/, 'sales-manager'],
  [/\bgrowth marketing\b/, 'growth-marketing-manager'],
  [/\bmarketing manager\b/, 'marketing-manager'],
  [/\boperations manager\b/, 'operations-manager'],
  [/\bfinance manager\b/, 'finance-manager'],
  [/\b(hr|human resources) manager\b/, 'hr-manager'],
  [/\bsupply chain\b/, 'supply-chain-manager'],
  [/\bprocurement\b/, 'procurement-manager'],
  [/\btalent acquisition\b|\brecruiting manager\b/, 'talent-acquisition-manager'],
]
const ROLE_RULES: Array<[RegExp, string]> = [
  [/\bsite reliability\b|\bsre\b/, 'site-reliability-engineer'],
  [/\bmlops\b/, 'mlops-engineer'],
  [/\bdev(sec)?ops\b/, 'devops-engineer'],
  [/\bcomputer vision\b/, 'computer-vision-engineer'],
  [/\b(machine learning|ml)\b.*\b(engineer|developer)\b/, 'machine-learning-engineer'],
  [/\b(ai|llm|genai|generative ai)\b.*\b(engineer|developer)\b/, 'ai-engineer'],
  [/\bdata scien/, 'data-scientist'],
  [/\bapplied scientist\b/, 'applied-scientist'],
  [/\bresearch scientist\b/, 'research-scientist'],
  [/\banalytics engineer/, 'analytics-engineer'],
  [/\bdata architect/, 'data-architect'],
  [/\bdata (engineer|engineering)\b|\bdata (platform|integration|pipeline) (engineer|developer)\b|\betl developer\b/, 'data-engineer'],
  [/\b(business intelligence|bi) (analyst|developer)\b/, 'business-intelligence-analyst'],
  [/\bdata analyst\b/, 'data-analyst'],
  [/\bfull[- ]?stack\b/, 'full-stack-engineer'],
  [/\bfront[- ]?end\b/, 'frontend-engineer'],
  [/\bback[- ]?end\b/, 'backend-engineer'],
  [/\bios\b/, 'ios-engineer'],
  [/\bandroid\b/, 'android-engineer'],
  [/\bmobile (engineer|developer)\b/, 'mobile-engineer'],
  [/\bembedded (software )?(engineer|developer)\b/, 'embedded-engineer'],
  [/\bfirmware\b/, 'firmware-engineer'],
  [/\b(cyber ?security|security|infosec|application security|cloud security)\b.*\b(engineer|architect)\b/, 'security-engineer'],
  [/\bcloud architect\b/, 'cloud-architect'],
  [/\bcloud engineer\b/, 'cloud-engineer'],
  [/\bsolutions? architect\b/, 'solutions-architect'],
  [/\benterprise architect\b/, 'enterprise-architect'],
  [/\bsoftware architect\b/, 'software-architect'],
  [/\bsolutions? engineer\b/, 'solutions-engineer'],
  [/\bsales engineer\b/, 'sales-engineer'],
  [/\bplatform engineer\b/, 'platform-engineer'],
  [/\binfrastructure engineer\b/, 'infrastructure-engineer'],
  [/\bnetwork engineer\b/, 'network-engineer'],
  [/\bsystems? administrator\b|\bsysadmin\b/, 'systems-administrator'],
  [/\b(qa|quality assurance)\b.*\b(engineer|tester|automation)\b|\bsdet\b|\btest automation\b/, 'qa-engineer'],
  [/\btest engineer\b/, 'test-engineer'],
  [/\bsystems? engineer\b/, 'systems-engineer'],
  [/\bsupport engineer\b/, 'support-engineer'],
  [/\bdatabase administrator\b|\bdba\b/, 'database-engineer'],
  [/\bsoftware (engineer|developer|development engineer)\b|\bmember of technical staff\b|\bforward deployed engineer\b/, 'software-engineer'],
  [/\b(python|java|golang|ruby|rust|c\+\+|c#|\.net|node(\.js)?|typescript|javascript|scala|kotlin|php|servicenow|salesforce)\b.*\b(engineer|developer)\b/, 'software-engineer'],
  [/\bweb developer\b/, 'web-developer'],
  [/\btechnical writer\b/, 'technical-writer'],
  [/\bproduct designer\b/, 'product-designer'],
  [/\bux research/, 'ux-researcher'],
  [/\b(ux|ui\/ux|ux\/ui|user experience) designer\b/, 'ux-designer'],
  [/\bgraphic designer\b/, 'graphic-designer'],
  [/\bscrum master\b/, 'scrum-master'],
  [/\b(enterprise |strategic )?account executive\b/, 'account-executive'],
  [/\bsales development representative\b|\bsdr\b/, 'sales-development-representative'],
  [/\bbusiness systems analyst\b/, 'business-systems-analyst'],
  [/\bbusiness analyst\b/, 'business-analyst'],
  [/\bfinancial analyst\b/, 'financial-analyst'],
  [/\bfp&a\b/, 'fp-a-analyst'],
  [/\bcontroll(er|ing)\b|\bcontr[oô]leur\b/, 'controller'],
  [/accountant|buchhalter/, 'accountant'],
  [/\bgeneral counsel\b/, 'general-counsel'],
  [/\b(counsel|attorney|lawyer)\b/, 'legal-counsel'],
  [/\brecruiter\b/, 'recruiter'],
  [/\bhr business partner\b|\bhrbp\b/, 'hr-business-partner'],
  [/\bchief of staff\b/, 'chief-of-staff'],
  [/\bexecutive assistant\b/, 'executive-assistant'],
  [/\bsolutions? consultant\b/, 'solutions-consultant'],
  [/\bconsultant\b/, 'consultant'],
  [/\b(developer|entwickler)\b/, 'software-developer'],
]

/** The canonical base role a title's words name, or null. Expects a lower-cased title. */
export function classifyTitle(lower: string): string | null {
  const rules = /\b(director|head of|vp|vice president|chief|president)\b/.test(lower)
    ? LEADERSHIP_RULES
    : /(manager|management|leiter)\b/.test(lower)
      ? MANAGER_RULES
      : ROLE_RULES
  return rules.find(([pattern]) => pattern.test(lower))?.[1] ?? null
}

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
