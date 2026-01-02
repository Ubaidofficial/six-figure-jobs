// lib/scrapers/_boardHelpers.ts
import { ingestBoardJob, type BoardJobInput as IngestJobInput } from '../jobs/ingestBoardJob'
import type { AtsProvider } from './ats/types'

export type BoardJobInput = {
  board: string
  externalId: string
  title: string
  company: string
  /** Canonical job detail URL on the board (optional; defaults to applyUrl) */
  url?: string
  applyUrl: string
  location?: string | null
  salaryText?: string | null
  remote?: boolean
  companyWebsiteUrl?: string | null
  companyLinkedInUrl?: string | null
  explicitAtsProvider?: AtsProvider | null
  explicitAtsUrl?: string | null
}

export async function upsertBoardJob(input: BoardJobInput) {
  const {
    board,
    externalId,
    title,
    company,
    url,
    applyUrl,
    location,
    salaryText,
    remote,
    companyWebsiteUrl,
    companyLinkedInUrl,
    explicitAtsProvider,
    explicitAtsUrl,
  } = input

  // Delegate to the central board ingest so we get dedupe + salary flags
  const job: IngestJobInput = {
    externalId,
    title,
    url: url || applyUrl,
    rawCompanyName: company,
    companyWebsiteUrl: companyWebsiteUrl ?? null,
    companyLinkedInUrl: companyLinkedInUrl ?? null,
    locationText: location ?? null,
    isRemote: remote ?? null,
    applyUrl,
    descriptionText: salaryText ?? null, // allow salary parsing from text if available
    explicitAtsProvider: explicitAtsProvider ?? null,
    explicitAtsUrl: explicitAtsUrl ?? null,
    raw: {
      sourceBoard: board,
      salaryText: salaryText ?? null,
    },
  }

  return ingestBoardJob(board, job)
}
