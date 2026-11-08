// lib/roles/relatedRoles.ts
// "Trending in <field>" chips on /jobs/<role>: other roles in the same field, ranked by our own listings.
import { isCanonicalSlug, isTier1Slug } from './canonicalSlugs'
import { SEARCH_ROLE_OPTIONS, type SearchRoleOption } from './searchRoles'
import { findBestMatchingRole } from './slugMatcher'

const SENIORITY_PREFIX = /^(senior|staff|principal|lead|junior|associate)-/

/** Same floor as the role-page index gate, so chips only point at hubs with real listings. */
const MIN_JOBS = 3

export type RoleSlugCount = { roleSlug: string; total: number; recent: number }
export type RelatedRole = { slug: string; label: string; total: number; recent: number }

function cleanLabel(label: string): string {
  return label.replace(/\s*\([^)]*\)/g, '').trim()
}

/**
 * The canonical /jobs/<slug> page for a search option, or null. Indexed (tier-1) pages win: the option slug, then the
 * slugified label (`ml-engineer` "Machine Learning Engineer" -> `machine-learning-engineer`); then any canonical
 * slug; then the fuzzy matcher, trusted only when it extends the same slug (`product-marketing` ->
 * `product-marketing-manager`), since it also maps unrelated roles (`art-director` -> `cto`).
 */
function canonicalFor(opt: SearchRoleOption): string | null {
  const fromLabel = cleanLabel(opt.label).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  if (isTier1Slug(opt.slug)) return opt.slug
  if (isTier1Slug(fromLabel)) return fromLabel
  if (isCanonicalSlug(opt.slug)) return opt.slug
  if (isCanonicalSlug(fromLabel)) return fromLabel
  const match = findBestMatchingRole(opt.slug)
  return match && match.startsWith(`${opt.slug}-`) ? match : null
}

/** Indexed (tier-1) role pages with no search option, so they still get a field and appear in it. */
const EXTRA_ROLES: Array<{ slug: string; label: string; category: string }> = [
  { slug: 'site-reliability-engineer', label: 'Site Reliability Engineer', category: 'Software Engineering' },
  { slug: 'developer-advocate', label: 'Developer Advocate', category: 'Software Engineering' },
  { slug: 'technical-lead', label: 'Technical Lead', category: 'Software Engineering' },
  { slug: 'technical-writer', label: 'Technical Writer', category: 'Content & Communications' },
  { slug: 'enterprise-account-executive', label: 'Enterprise Account Executive', category: 'Sales' },
  { slug: 'ai-researcher', label: 'AI Researcher', category: 'Data & AI' },
  { slug: 'applied-scientist', label: 'Applied Scientist', category: 'Data & AI' },
  { slug: 'mlops-engineer', label: 'MLOps Engineer', category: 'Data & AI' },
  { slug: 'generative-ai-engineer', label: 'Generative AI Engineer', category: 'Data & AI' },
  { slug: 'deep-learning-engineer', label: 'Deep Learning Engineer', category: 'Data & AI' },
  { slug: 'ai-product-manager', label: 'AI Product Manager', category: 'Product' },
  { slug: 'ux-designer', label: 'UX Designer', category: 'Design' },
  { slug: 'ux-researcher', label: 'UX Researcher', category: 'Design' },
  { slug: 'engineering-manager', label: 'Engineering Manager', category: 'Leadership' },
  { slug: 'vp-engineering', label: 'VP of Engineering', category: 'Leadership' },
  { slug: 'cto', label: 'CTO', category: 'Leadership' },
  { slug: 'ceo', label: 'CEO', category: 'Leadership' },
  { slug: 'ciso', label: 'CISO', category: 'Leadership' },
]

type Candidate = { optSlug: string; slug: string | null; label: string; category: string }

const CANDIDATES: Candidate[] = [
  ...SEARCH_ROLE_OPTIONS.flatMap((opt) =>
    opt.category ? [{ optSlug: opt.slug, slug: canonicalFor(opt), label: cleanLabel(opt.label), category: opt.category }] : [],
  ),
  ...EXTRA_ROLES.map((r) => ({ optSlug: r.slug, ...r })),
]

/** The field of a role page: a candidate for the same page, else the option whose slug the page's slug extends. */
function categoryOf(roleSlug: string): string | null {
  const base = roleSlug.replace(SENIORITY_PREFIX, '')
  const exact = CANDIDATES.find((c) => [c.slug, c.optSlug].some((s) => s === roleSlug || s === base))
  if (exact) return exact.category
  const prefixed = CANDIDATES.filter((c) => base.startsWith(`${c.optSlug}-`)).sort((a, b) => b.optSlug.length - a.optSlug.length)
  return prefixed[0]?.category ?? null
}

/** Jobs for a role page: every stored roleSlug that equals or contains the slug, as buildWhere() matches them. */
function countFor(slug: string, counts: RoleSlugCount[]): { total: number; recent: number } {
  let total = 0
  let recent = 0
  for (const c of counts) {
    if (c.roleSlug.includes(slug)) {
      total += c.total
      recent += c.recent
    }
  }
  return { total, recent }
}

/**
 * Role pages for the search box: with a query, roles whose name has a word starting with each typed word
 * ("prod man" -> Product Manager); without one, the roles with the most jobs. Only pages with at least MIN_JOBS jobs.
 */
export function matchRolePages(query: string, counts: RoleSlugCount[], limit = 3): RelatedRole[] {
  const words = query.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean)
  const seen = new Set<string>()
  const roles: RelatedRole[] = []
  for (const { slug, label } of CANDIDATES) {
    if (!slug || seen.has(slug)) continue
    const names = `${label} ${slug.replace(/-/g, ' ')}`.toLowerCase().split(/[^a-z0-9+#]+/)
    if (!words.every((w) => names.some((n) => n.startsWith(w)))) continue
    seen.add(slug)
    const { total, recent } = countFor(slug, counts)
    if (total >= MIN_JOBS) roles.push({ slug, label, total, recent })
  }
  return roles.sort((a, b) => b.total - a.total || a.label.localeCompare(b.label)).slice(0, limit)
}

/**
 * Other canonical roles in the current role's field, with at least MIN_JOBS live jobs, ordered by jobs posted
 * recently (then total). A job counts toward a role when its roleSlug equals or contains the role's slug, the same
 * match buildWhere() uses for the role page, so each chip's count matches the page it links to.
 */
export function rankRelatedRoles(
  currentSlug: string,
  counts: RoleSlugCount[],
  limit = 8,
): { category: string; roles: RelatedRole[] } | null {
  const category = categoryOf(currentSlug)
  if (!category) return null
  const base = currentSlug.replace(SENIORITY_PREFIX, '')

  const seen = new Set<string>()
  const roles: RelatedRole[] = []
  for (const { slug, label, category: candidateCategory } of CANDIDATES) {
    if (candidateCategory !== category || !slug || seen.has(slug) || slug === currentSlug || slug === base) continue
    seen.add(slug)

    const { total, recent } = countFor(slug, counts)
    if (total < MIN_JOBS) continue
    roles.push({ slug, label, total, recent })
  }

  roles.sort((a, b) => b.recent - a.recent || b.total - a.total || a.label.localeCompare(b.label))
  return roles.length ? { category, roles: roles.slice(0, limit) } : null
}
