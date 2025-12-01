// lib/scrapers/_boardHelpers.ts
import { ingestBoardJob, type BoardJobInput as IngestJobInput } from '../jobs/ingestBoardJob'

export type BoardJobInput = {
  board: string
  externalId: string
  title: string
  company: string
  applyUrl: string
  location?: string | null
  salaryText?: string | null
  remote?: boolean
  companyWebsiteUrl?: string | null
  companyLinkedInUrl?: string | null
}

export async function upsertBoardJob(input: BoardJobInput) {
  const {
    board,
    externalId,
    title,
    company,
    applyUrl,
    location,
    salaryText,
    remote,
    companyWebsiteUrl,
    companyLinkedInUrl,
  } = input

  // Delegate to the central board ingest so we get dedupe + salary flags
  const job: IngestJobInput = {
    externalId,
    title,
    url: applyUrl,
    rawCompanyName: company,
    companyWebsiteUrl: companyWebsiteUrl ?? null,
    companyLinkedInUrl: companyLinkedInUrl ?? null,
    locationText: location ?? null,
    isRemote: remote ?? null,
    applyUrl,
    descriptionText: salaryText ?? null, // allow salary parsing from text if available
    raw: {
      sourceBoard: board,
      salaryText: salaryText ?? null,
    },
  }

  return ingestBoardJob(board, job)
}
