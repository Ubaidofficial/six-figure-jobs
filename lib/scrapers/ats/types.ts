// lib/scrapers/ats/types.ts

export const SUPPORTED_ATS_PROVIDERS = [
  'greenhouse',
  'lever',
  'ashby',
  'workday',
  'bamboohr',
  'smartrecruiters',
  'recruitee',
  'workable',
  'teamtailor',
  'breezy',
  'icims',
  // Added 2026-11-25 (remote100k coverage): Oracle Recruiting Cloud candidate sites and Gem job boards.
  'oraclecloud',
  'gem',
] as const

export type AtsProvider = (typeof SUPPORTED_ATS_PROVIDERS)[number]

export function isSupportedAtsProvider(value: string | null | undefined): value is AtsProvider {
  return SUPPORTED_ATS_PROVIDERS.includes(value as AtsProvider)
}

export interface AtsJob {
  externalId: string
  title: string
  url: string
  locationText?: string | null
  remote?: boolean | null
  /** The board's structured workplace type, when it has one (Ashby). */
  workplaceType?: 'remote' | 'hybrid' | 'onsite' | null
  /**
   * The source's own structured country for the job, when it states one (Workday's requisition country, Oracle's
   * primary location country, freehire when it lists exactly one country). Used only when the location text names none.
   */
  countryCode?: string | null

  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  salaryInterval?: string | null
  salaryRaw?: string | null

  employmentType?: string | null
  descriptionHtml?: string | null

  roleSlug?: string | null
  baseRoleSlug?: string | null
  seniority?: string | null
  discipline?: string | null
  isManager?: boolean

  postedAt?: Date | null
  updatedAt?: Date | null
  validThrough?: Date | null

  raw?: any
}

export type ATSResult =
  | { success: true; jobs: AtsJob[]; source: AtsProvider; company?: string; atsUrl?: string }
  | { success: false; error: string; source: AtsProvider; company?: string; atsUrl?: string }
