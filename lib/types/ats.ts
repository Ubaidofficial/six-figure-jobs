// lib/types/ats.ts

export type AtsJob = {
  externalId: string
  title: string
  url: string
  locationText: string | null
  remote: boolean | null
  salaryMin?: bigint | null
  salaryMax?: bigint | null
  salaryCurrency?: string | null
  employmentType?: string | null
  postedAt?: Date | null
  updatedAt?: Date | null
  raw: any
}

export type AtsScraperFn = (atsUrl: string) => Promise<AtsJob[]>

export type SupportedAtsProvider =
  | 'greenhouse'
  | 'lever'
  | 'ashby'
  | 'workday'
  | 'smartrecruiters'
  | 'bamboohr'
  | 'recruitee'
  | 'workable'
