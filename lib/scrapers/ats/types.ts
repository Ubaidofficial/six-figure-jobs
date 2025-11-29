// lib/scrapers/ats/types.ts

export type AtsProvider =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'

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
  descriptionHtml?: string | null  // ADDED: for ATS scrapers to extract descriptions
  roleSlug?: string | null
  baseRoleSlug?: string | null
  seniority?: string | null
  discipline?: string | null
  isManager?: boolean

  postedAt?: Date | null
  updatedAt?: Date | null

  raw?: any
}

export type AtsScraperFn = (atsUrl: string) => Promise<AtsJob[]>