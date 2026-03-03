// lib/scrapers/ats/types.ts

export type AtsProvider =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'bamboohr'
  | 'smartrecruiters'
  | 'recruitee'
  | 'teamtailor'
  | 'workable'
  | 'workable'
  | 'breezy'

export interface AtsJob {
  externalId: string
  title: string
  url: string
  locationText?: string | null
  remote?: boolean | null

  salaryMin?: number | null
  salaryMax?: number | null
  salaryCurrency?: string | null
  salaryInterval?: string | null

  employmentType?: string | null
  descriptionHtml?: string | null

  roleSlug?: string | null
  baseRoleSlug?: string | null
  seniority?: string | null
  discipline?: string | null
  isManager?: boolean

  postedAt?: Date | null
  updatedAt?: Date | null

  raw?: any
}

export type ATSResult =
  | { success: true; jobs: AtsJob[]; source: AtsProvider; company?: string; atsUrl?: string }
  | { success: false; error: string; source: AtsProvider; company?: string; atsUrl?: string }
