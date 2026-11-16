// lib/history/evidence.ts
//
// Keeps the sentence an enriched field was read from, with the reader and its version, in JobEvidence. The readers
// (benefitsEvidence, remoteEvidence) already return the verbatim, verified sentence, but the backfills used to store only the
// label or mode and drop the sentence, so a stored value could not be checked afterwards. With the sentence kept, a wrong value
// can be traced to the rule that read it, a reader's precision can be measured on its own output, and a page could one day show
// "we read this from the posting". Pay already keeps its sentence: payEvidence's quote is stored as the job's raw salary text.
//
// A row is written only together with the field it backs, and never twice for the same (job, field, value).
import type { PrismaClient } from '@prisma/client'

import { BENEFITS_EVIDENCE_VERSION, type BenefitEvidence } from '../jobs/benefitsEvidence'
import { REMOTE_EVIDENCE_VERSION, type RemoteEvidence } from '../jobs/remoteEvidence'

export type EvidenceField = 'benefits' | 'remoteMode'

export type EvidenceRecord = {
  jobId: string
  field: EvidenceField
  value: string
  quote: string
  extractor: string
  extractorVersion: number
}

/** One record per benefit, the value being the label that is stored in benefitsJson. */
export function benefitEvidenceRecords(jobId: string, benefits: readonly BenefitEvidence[]): EvidenceRecord[] {
  return benefits.map((b) => ({
    jobId,
    field: 'benefits',
    value: b.label,
    quote: b.quote,
    extractor: 'benefitsEvidence',
    extractorVersion: BENEFITS_EVIDENCE_VERSION,
  }))
}

/** The record for a remote mode, the value being the mode that is stored in remoteMode. */
export function remoteEvidenceRecord(jobId: string, found: RemoteEvidence): EvidenceRecord {
  return { jobId, field: 'remoteMode', value: found.mode, quote: found.quote, extractor: 'remoteEvidence', extractorVersion: REMOTE_EVIDENCE_VERSION }
}

/** Saves records, skipping any (job, field, value) already held. Returns how many were new. */
export async function saveEvidence(db: Pick<PrismaClient, 'jobEvidence'>, records: readonly EvidenceRecord[]): Promise<number> {
  if (!records.length) return 0
  const { count } = await db.jobEvidence.createMany({ data: [...records], skipDuplicates: true })
  return count
}
