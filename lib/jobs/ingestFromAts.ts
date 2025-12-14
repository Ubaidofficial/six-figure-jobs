// lib/jobs/ingestFromAts.ts
// Wrapper for ingesting jobs from ATS (Greenhouse, Lever, Ashby, Workday)
//
// This uses the central ingest function but preserves ATS-specific logic:
// - Role slug inference from title
// - Salary extraction from HTML
// - Specific job ID format
//
// NOTE: Company must already exist (created by board scrapers or seed scripts).

import { ingestJob } from '../ingest'
import { makeAtsSource } from '../ingest/sourcePriority'
import type { ScrapedJobInput } from '../ingest/types'
import type { CanonicalRoleSlug } from '../roles/canonicalSlugs'

// =============================================================================
// Types
// =============================================================================

export type UpsertAtsResult = {
  created: number
  updated: number
  skipped: number
  companyId?: string | null
  companySlug?: string | null
  totalJobs?: number
}

// =============================================================================
// Helpers (preserved from original)
// =============================================================================

/**
 * Infer a canonical role slug from a job title
 * Returns null if no canonical match found (prevents garbage URLs)
 *
 * CRITICAL: This function must ONLY return slugs from CANONICAL_ROLE_SLUGS
 * DO NOT fall back to slugify(title) - that creates garbage URLs!
 */
function inferRoleSlugFromTitle(
  title: string | null | undefined,
): CanonicalRoleSlug | null {
  if (!title) return null

  const t = ` ${title.toLowerCase()} `

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA & AI/ML ROLES (Check first - most specific)
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('machine learning') || t.includes(' ml ') || t.includes('ml engineer')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-machine-learning-engineer'
    return 'machine-learning-engineer'
  }

  if (t.includes('data scientist')) {
    if (t.includes('staff')) return 'staff-data-scientist'
    if (t.includes('senior') || t.includes('sr ')) return 'senior-data-scientist'
    return 'data-scientist'
  }

  if (t.includes('ai engineer') || t.includes('artificial intelligence engineer')) {
    return 'ai-engineer'
  }

  if (t.includes('research scientist')) {
    return 'research-scientist'
  }

  if (t.includes('research engineer')) {
    return 'research-engineer'
  }

  if (t.includes('applied scientist')) {
    return 'applied-scientist'
  }

  if (t.includes('mlops')) {
    return 'mlops-engineer'
  }

  if (t.includes('nlp') || t.includes('natural language')) {
    return 'nlp-engineer'
  }

  if (t.includes('computer vision')) {
    return 'computer-vision-engineer'
  }

  if (t.includes('deep learning')) {
    return 'deep-learning-engineer'
  }

  if (t.includes('data engineer')) {
    if (t.includes('staff')) return 'staff-data-engineer'
    if (t.includes('senior') || t.includes('sr ')) return 'senior-data-engineer'
    return 'data-engineer'
  }

  if (t.includes('data analyst')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-data-analyst'
    return 'data-analyst'
  }

  if (t.includes('data architect')) {
    return 'data-architect'
  }

  if (t.includes('analytics engineer')) {
    return 'analytics-engineer'
  }

  if (t.includes('business intelligence') || t.includes(' bi ') || t.includes('bi analyst')) {
    return 'business-intelligence-analyst'
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINEERING SPECIALIZATIONS (Before generic software engineer)
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('frontend') || t.includes('front-end') || t.includes('front end')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-frontend-engineer'
    return 'frontend-engineer'
  }

  if (t.includes('backend') || t.includes('back-end') || t.includes('back end')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-backend-engineer'
    return 'backend-engineer'
  }

  if (t.includes('full stack') || t.includes('full-stack') || t.includes('fullstack')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-full-stack-engineer'
    return 'full-stack-engineer'
  }

  if (t.includes('devops') || t.includes('dev ops')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-devops-engineer'
    return 'devops-engineer'
  }

  if (t.includes('site reliability') || t.includes('sre ') || t.includes(' sre')) {
    return 'site-reliability-engineer'
  }

  if (t.includes('platform engineer')) {
    return 'platform-engineer'
  }

  if (t.includes('infrastructure engineer')) {
    return 'infrastructure-engineer'
  }

  if (t.includes('cloud engineer')) {
    return 'cloud-engineer'
  }

  if (t.includes('security engineer')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-security-engineer'
    return 'security-engineer'
  }

  if (t.includes('qa engineer') || t.includes('quality assurance engineer')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-qa-engineer'
    return 'qa-engineer'
  }

  if (t.includes('test engineer')) {
    return 'test-engineer'
  }

  if (t.includes('automation engineer')) {
    return 'automation-engineer'
  }

  if (t.includes('ios engineer') || t.includes('ios developer')) {
    return 'ios-engineer'
  }

  if (t.includes('android engineer') || t.includes('android developer')) {
    return 'android-engineer'
  }

  if (t.includes('mobile engineer') || t.includes('mobile developer')) {
    return 'mobile-engineer'
  }

  if (t.includes('embedded engineer') || t.includes('embedded software')) {
    return 'embedded-engineer'
  }

  if (t.includes('firmware engineer')) {
    return 'firmware-engineer'
  }

  if (t.includes('systems engineer') && !t.includes('admin')) {
    return 'systems-engineer'
  }

  if (t.includes('network engineer')) {
    return 'network-engineer'
  }

  if (t.includes('database engineer') || t.includes('dba ') || t.includes(' dba')) {
    return 'database-engineer'
  }

  if (t.includes('solutions engineer')) {
    return 'solutions-engineer'
  }

  if (t.includes('sales engineer') || t.includes('pre-sales engineer')) {
    return 'sales-engineer'
  }

  if (t.includes('support engineer')) {
    return 'support-engineer'
  }

  if (t.includes('release engineer')) {
    return 'release-engineer'
  }

  if (t.includes('build engineer')) {
    return 'build-engineer'
  }

  if (t.includes('performance engineer')) {
    return 'performance-engineer'
  }

  if (t.includes('reliability engineer') && !t.includes('site')) {
    return 'reliability-engineer'
  }

  if (t.includes('api engineer')) {
    return 'api-engineer'
  }

  if (t.includes('protocol engineer')) {
    return 'protocol-engineer'
  }

  if (t.includes('blockchain engineer') || t.includes('smart contract')) {
    return 'blockchain-engineer'
  }

  if (t.includes('systems administrator') || t.includes('sysadmin')) {
    return 'systems-administrator'
  }

  if (t.includes('integration engineer')) {
    return 'integration-engineer'
  }

  // Generic software engineer (check last in engineering section)
  if (
    t.includes('software engineer') ||
    t.includes('software developer') ||
    t.includes('swe ') ||
    t.includes(' swe')
  ) {
    if (t.includes('principal')) return 'principal-software-engineer'
    if (t.includes('staff')) return 'staff-software-engineer'
    if (t.includes('senior') || t.includes('sr ')) return 'senior-software-engineer'
    return 'software-engineer'
  }

  // Web Developer (after software engineer check)
  if (t.includes('web developer') || t.includes('web engineer')) {
    return 'web-developer'
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ARCHITECTURE ROLES
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('solutions architect')) {
    return 'solutions-architect'
  }

  if (t.includes('enterprise architect')) {
    return 'enterprise-architect'
  }

  if (t.includes('cloud architect')) {
    return 'cloud-architect'
  }

  if (t.includes('software architect') || (t.includes('architect') && t.includes('software'))) {
    return 'software-architect'
  }

  if (t.includes('architect') && !t.includes('manager')) {
    return 'software-architect'
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PRODUCT & DESIGN ROLES
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('product manager') || t.includes(' pm ') || t.includes('product management')) {
    if (t.includes('chief') || t.includes('cpo')) return 'chief-product-officer'
    if (t.includes('vp') || t.includes('vice president')) return 'vp-product'
    if (t.includes('director')) return 'director-of-product'
    if (t.includes('principal')) return 'principal-product-manager'
    if (t.includes('group') || t.includes('gpm')) return 'group-product-manager'
    if (t.includes('senior') || t.includes('sr ')) return 'senior-product-manager'
    return 'product-manager'
  }

  if (t.includes('product designer')) {
    if (t.includes('staff')) return 'staff-product-designer'
    if (t.includes('senior') || t.includes('sr ')) return 'senior-product-designer'
    return 'product-designer'
  }

  if (t.includes('ux designer') || t.includes('user experience designer')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-ux-designer'
    return 'ux-designer'
  }

  if (t.includes('ui designer') || t.includes('user interface designer')) {
    return 'ui-designer'
  }

  if (t.includes('ux researcher') || t.includes('user researcher') || t.includes('design researcher')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-ux-researcher'
    return 'ux-researcher'
  }

  if (t.includes('visual designer')) return 'visual-designer'
  if (t.includes('brand designer')) return 'brand-designer'
  if (t.includes('creative director')) return 'creative-director'
  if (t.includes('head of design') || t.includes('design director')) return 'head-of-design'
  if (t.includes('design manager')) return 'design-manager'

  // Generic designer - default to product-designer
  if (t.includes('designer') && !t.includes('manager')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-product-designer'
    return 'product-designer'
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINEERING MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('cto') || t.includes('chief technology officer')) return 'cto'

  if (
    t.includes('vp of engineering') ||
    t.includes('vp engineering') ||
    t.includes('vice president of engineering')
  ) {
    if (t.includes('svp') || t.includes('senior vp')) return 'svp-engineering'
    return 'vp-engineering'
  }

  if (t.includes('director of engineering') || t.includes('engineering director')) {
    if (t.includes('senior')) return 'senior-director-of-engineering'
    return 'director-of-engineering'
  }

  if (t.includes('head of engineering')) return 'head-of-engineering'

  if (t.includes('engineering manager') || (t.includes('manager') && t.includes('engineer'))) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-engineering-manager'
    return 'engineering-manager'
  }

  if (t.includes('technical lead') || t.includes('tech lead')) return 'technical-lead'
  if (t.includes('team lead')) return 'team-lead'
  if (t.includes('technical program manager') || t.includes('tpm ') || t.includes(' tpm'))
    return 'technical-program-manager'

  // ═══════════════════════════════════════════════════════════════════════════
  // BUSINESS & SALES ROLES
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('account executive')) {
    if (t.includes('enterprise')) return 'enterprise-account-executive'
    if (t.includes('senior') || t.includes('sr ')) return 'senior-account-executive'
    return 'account-executive'
  }

  if (t.includes('account manager')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-account-manager'
    return 'account-manager'
  }

  if (t.includes('customer success')) {
    if (t.includes('director')) return 'customer-success-director'
    if (t.includes('senior') || t.includes('sr ')) return 'senior-customer-success-manager'
    return 'customer-success-manager'
  }

  if (t.includes('sales manager')) return 'sales-manager'
  if (t.includes('sales director')) return 'sales-director'
  if (t.includes('vp sales') || t.includes('vp of sales') || t.includes('vice president of sales'))
    return 'vp-sales'
  if (t.includes('head of sales')) return 'head-of-sales'
  if (t.includes('chief revenue officer') || t.includes('cro ') || t.includes(' cro'))
    return 'chief-revenue-officer'
  if (t.includes('business development manager') || t.includes('bdm '))
    return 'business-development-manager'
  if (t.includes('business development representative') || t.includes('bdr ') || t.includes(' bdr'))
    return 'business-development-representative'
  if (t.includes('partnerships manager') || t.includes('partner manager')) return 'partnerships-manager'
  if (t.includes('channel manager')) return 'channel-manager'
  if (t.includes('revenue operations') || t.includes('revops')) return 'revenue-operations-manager'
  if (t.includes('sales operations')) return 'sales-operations-manager'
  if (t.includes('sales enablement')) return 'sales-enablement-manager'
  if (t.includes('solution consultant')) return 'solution-consultant'

  // ═══════════════════════════════════════════════════════════════════════════
  // MARKETING ROLES
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('cmo') || t.includes('chief marketing officer')) return 'cmo'
  if (t.includes('vp marketing') || t.includes('vp of marketing') || t.includes('vice president of marketing'))
    return 'vp-marketing'
  if (t.includes('marketing director') || t.includes('director of marketing')) return 'marketing-director'
  if (t.includes('head of marketing')) return 'head-of-marketing'

  if (t.includes('product marketing manager') || t.includes('pmm ') || t.includes(' pmm')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-product-marketing-manager'
    return 'product-marketing-manager'
  }

  if (t.includes('growth marketing') || t.includes('growth manager')) return 'growth-marketing-manager'
  if (t.includes('demand generation') || t.includes('demand gen')) return 'demand-generation-manager'
  if (t.includes('performance marketing')) return 'performance-marketing-manager'
  if (t.includes('content marketing')) return 'content-marketing-manager'
  if (t.includes('content manager')) return 'content-manager'
  if (t.includes('seo manager') || t.includes('seo specialist')) return 'seo-manager'

  if (t.includes('marketing manager')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-marketing-manager'
    return 'marketing-manager'
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // FINANCE & OPERATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('cfo') || t.includes('chief financial officer')) return 'cfo'
  if (t.includes('controller')) return 'controller'
  if (t.includes('finance manager')) return 'finance-manager'

  if (t.includes('financial analyst')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-financial-analyst'
    return 'financial-analyst'
  }

  if (t.includes('accountant')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-accountant'
    return 'accountant'
  }

  if (t.includes('tax manager')) return 'tax-manager'
  if (t.includes('coo') || t.includes('chief operating officer')) return 'chief-operating-officer'
  if (t.includes('operations director') || t.includes('director of operations')) return 'operations-director'
  if (t.includes('operations manager')) return 'operations-manager'
  if (t.includes('business analyst') && !t.includes('intelligence')) return 'business-analyst'

  // ═══════════════════════════════════════════════════════════════════════════
  // HR & RECRUITING
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('chief people officer') || t.includes('chief human resources')) return 'chief-people-officer'
  if (t.includes('head of people') || t.includes('head of hr')) return 'head-of-people'
  if (t.includes('talent acquisition manager')) return 'talent-acquisition-manager'
  if (t.includes('recruiting manager') || t.includes('recruitment manager')) return 'recruiting-manager'
  if (t.includes('technical recruiter')) return 'technical-recruiter'

  if (t.includes('recruiter')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-recruiter'
    return 'recruiter'
  }

  if (t.includes('hr manager') || t.includes('human resources manager')) return 'hr-manager'
  if (t.includes('hr business partner') || t.includes('hrbp')) return 'hr-business-partner'
  if (t.includes('people operations') || t.includes('people ops')) return 'people-operations-manager'

  // ═══════════════════════════════════════════════════════════════════════════
  // EXECUTIVE ROLES
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('ceo') || t.includes('chief executive officer')) return 'ceo'
  if (t.includes('president') && !t.includes('vice')) return 'president'
  if (t.includes('managing director')) return 'managing-director'
  if (t.includes('general manager')) return 'general-manager'
  if (t.includes('chief of staff')) return 'chief-of-staff'
  if (t.includes('ciso') || t.includes('chief information security')) return 'ciso'
  if (t.includes('vp operations') || t.includes('vp of operations')) return 'vp-operations'

  // ═══════════════════════════════════════════════════════════════════════════
  // OTHER ROLES
  // ═══════════════════════════════════════════════════════════════════════════

  if (t.includes('technical writer')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-technical-writer'
    return 'technical-writer'
  }

  if (t.includes('program manager') && !t.includes('technical')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-program-manager'
    return 'program-manager'
  }

  if (t.includes('project manager')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-project-manager'
    return 'project-manager'
  }

  if (t.includes('scrum master')) return 'scrum-master'
  if (t.includes('agile coach')) return 'agile-coach'
  if (t.includes('strategy consultant')) return 'strategy-consultant'
  if (t.includes('management consultant')) return 'management-consultant'
  if (t.includes('consultant')) return 'consultant'
  if (t.includes('compliance manager') || t.includes('compliance officer')) return 'compliance-manager'
  if (t.includes('legal counsel') || t.includes('attorney') || t.includes('lawyer')) return 'legal-counsel'
  if (t.includes('general counsel') || t.includes('gc ') || t.includes(' gc')) return 'general-counsel'

  // Catch-all
  if (t.includes('engineer') && !t.includes('manager') && !t.includes('director')) {
    if (t.includes('senior') || t.includes('sr ')) return 'senior-software-engineer'
    return 'software-engineer'
  }

  return null
}

// =============================================================================
// Salary Parsing (FIXED)
// =============================================================================

type SalaryInfo = {
  minAnnual?: bigint | null
  maxAnnual?: bigint | null
  currency?: string | null
  isHundredKLocal?: boolean
  salaryRaw?: string | null
  salaryMin?: bigint | null
  salaryMax?: bigint | null
  salaryCurrency?: string | null
  salaryPeriod?: string | null
}

function extractSalaryFromHtml(html?: string | null): SalaryInfo {
  if (!html) return {}

  let decoded = html
  if (!/<\w+/i.test(html) && /&lt;\/?\w+/i.test(html)) {
    decoded = decodeEntities(html)
  }

  const salaryRaw = html
  const text = stripTags(decoded)

  let numbers: number[] = []

  // $120,000 style
  const commaMatches = text.match(/\$ ?([0-9]{2,3}(?:,[0-9]{3})*)/g)
  if (commaMatches?.length) {
    numbers = commaMatches
      .map((m) => m.replace(/[^0-9]/g, ''))
      .map((n) => Number(n))
      .filter((n) => Number.isFinite(n))
  }

  // 120k style (handles "$120k" and prevents "$120,000k" inflation)
  if (!numbers.length) {
    const kMatches = text.match(/\$ ?([0-9]{2,3}(?:,[0-9]{3})*)\s*k/gi)
    if (kMatches?.length) {
      numbers = kMatches
        .map((m) => {
          const rawNum = Number(m.replace(/[^0-9]/g, ''))
          if (!Number.isFinite(rawNum)) return NaN
          // Only multiply when it looks like "120k" (not "120,000k")
          return rawNum >= 1000 ? rawNum : rawNum * 1000
        })
        .filter((n) => Number.isFinite(n))
    }
  }

  if (!numbers.length) return { salaryRaw }

  let min = numbers[0]
  let max = numbers[0]
  if (numbers.length >= 2) {
    min = Math.min(numbers[0], numbers[1])
    max = Math.max(numbers[0], numbers[1])
  }

  // Sanity guard: ignore obviously corrupt values
  if (min > 2_000_000 || max > 2_000_000) {
    return { salaryRaw }
  }

  const minAnnual = BigInt(min)
  const maxAnnual = BigInt(max)
  const isHundredKLocal = max >= 100_000 || min >= 100_000

  return {
    minAnnual,
    maxAnnual,
    currency: 'USD',
    salaryRaw,
    isHundredKLocal,
    salaryMin: minAnnual,
    salaryMax: maxAnnual,
    salaryCurrency: 'USD',
    salaryPeriod: 'year',
  }
}

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function stripTags(str: string): string {
  return str.replace(/<\/?[^>]+(>|$)/g, '')
}

// =============================================================================
// Main Function
// =============================================================================

export async function upsertJobsForCompanyFromAts(
  company: any,
  rawJobs: any[],
): Promise<UpsertAtsResult> {
  if (!company || !company.id || !Array.isArray(rawJobs) || rawJobs.length === 0) {
    console.log('[ATS ingest] No company or jobs to ingest')
    return {
      created: 0,
      updated: 0,
      skipped: 0,
      companyId: company?.id ?? null,
      companySlug: company?.slug ?? null,
      totalJobs: rawJobs?.length ?? 0,
    }
  }

  const companyId: string = company.id
  const companySlug: string | null = company.slug ?? null
  const companyName: string = company.name ?? 'Unknown company'
  const companyLogo: string | null = company.logoUrl ?? null
  const atsProvider: string = company.atsProvider ?? 'unknown'

  let created = 0
  let updated = 0
  let skipped = 0

  for (const raw of rawJobs) {
    try {
      const externalId: string | null =
        (raw.externalId as string) ?? (raw.id != null ? String(raw.id) : null)

      if (!externalId) {
        skipped++
        continue
      }

      const title: string = raw.title || 'Unknown role'

      const locationText: string | null =
        raw.locationText ?? raw.location?.name ?? raw.location ?? null

      const isRemote: boolean =
        raw.remote === true || (locationText?.toLowerCase().includes('remote') ?? false)

      const jobUrl: string | null = raw.url ?? raw.absolute_url ?? null
      const applyUrl: string | null = raw.applyUrl ?? raw.absolute_url ?? jobUrl

      const descriptionHtml: string | null =
        raw.descriptionHtml ?? raw.description ?? raw.content ?? null

      const salarySourceHtml: string | null =
        raw.salaryHtml ?? raw.salaryRaw ?? raw.salary ?? descriptionHtml ?? null
      const salary = extractSalaryFromHtml(salarySourceHtml)

      const postedAt: Date | null = raw.postedAt
        ? new Date(raw.postedAt)
        : raw.updated_at
        ? new Date(raw.updated_at)
        : null

      const inferredRoleSlug = raw.roleSlug ?? inferRoleSlugFromTitle(title)

      const scrapedJob: ScrapedJobInput = {
        externalId,
        title,
        source: makeAtsSource(atsProvider),

        rawCompanyName: companyName,
        companyLogoUrl: companyLogo,

        url: jobUrl,
        applyUrl: applyUrl ?? jobUrl,

        locationText,
        isRemote,

        salaryRaw: salary.salaryRaw ?? null,
        salaryMin: salary.salaryMin ? Number(salary.salaryMin) : null,
        salaryMax: salary.salaryMax ? Number(salary.salaryMax) : null,
        salaryCurrency: salary.salaryCurrency ?? null,
        salaryInterval: salary.salaryPeriod ?? 'year',

        employmentType: raw.type ?? raw.employmentType ?? null,
        department: raw.department ?? null,
        descriptionHtml,
        descriptionText: null,

        postedAt,
        updatedAt: raw.updatedAt ? new Date(raw.updatedAt) : null,

        raw: {
          ...raw,
          _inferredRoleSlug: inferredRoleSlug,
        },
      }

      const result = await ingestJob(scrapedJob)

      switch (result.status) {
        case 'created':
          created++
          break
        case 'updated':
        case 'upgraded':
          updated++
          break
        default:
          skipped++
          break
      }
    } catch (err) {
      console.error('[ATS ingest] Failed to upsert job:', err)
      skipped++
    }
  }

  console.log(
    `[ATS ingest] ${companySlug ?? companyId} → created=${created}, updated=${updated}, skipped=${skipped}`,
  )

  return {
    created,
    updated,
    skipped,
    companyId,
    companySlug,
    totalJobs: rawJobs.length,
  }
}
