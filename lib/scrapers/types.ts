// lib/scrapers/types.ts

export type AtsProvider =
  | 'lever'
  | 'greenhouse'
  | 'ashby'
  | 'workday'
  | 'bamboohr'
  | 'smartrecruiters'
  | 'recruitee'
  | 'teamtailor';

export interface CompanySourceConfig {
  id: string;          // Prisma Company.id
  name: string;
  slug: string;        // e.g. "openai"
  atsProvider: AtsProvider;
  atsUrl: string;      // canonical ATS board URL
  countryCode?: string;
}

export interface RawAtsJob {
  externalId: string;
  title: string;
  url: string;
  descriptionHtml?: string;
  descriptionText?: string;
  locations: string[];
  remote: boolean | null;
  employmentType?: string;
  department?: string;
  createdAt?: Date | null;
  updatedAt?: Date | null;
  salaryStrings: string[];
  currencyHint?: string;
}

export interface NormalizedJobInput {
  companyId: string;
  companyName: string;
  title: string;
  slug: string;
  externalId: string;
  externalUrl: string;
  source: string;
  descriptionHtml: string | null;
  locations: string[];
  remote: boolean | null;
  employmentType: string | null;
  department: string | null;
  postedAt: Date | null;
  updatedAt: Date | null;
  minAnnual: number | null;
  maxAnnual: number | null;
  currency: string | null;
}
