// Writes a job's cleaned title (lib/jobs/cleanTitle.ts) with the dedupe key built from it, as the import would have
// stored it. Shared by scripts/cleanJobTitles.ts and the admin Review queue's "Use cleaned title" button. A job whose
// cleaned key another job of the same company already holds is left alone (two jobs would then share one key). The
// job's page address follows the title; the old address redirects (app/job/[slug]/page.tsx).
import { makeJobDedupeKey } from '../ingest/dedupeHelpers'
import { prisma } from '../prisma'
import { cleanJobTitle } from './cleanTitle'

export type CleanTitleJob = { id: string; title: string; companyId: string | null; locationRaw: string | null }
export type CleanTitleResult = { state: 'written'; title: string } | { state: 'unchanged' } | { state: 'clash' }

export async function applyCleanTitle(job: CleanTitleJob): Promise<CleanTitleResult> {
  const cleaned = cleanJobTitle(job.title, { location: job.locationRaw })
  if (cleaned === job.title) return { state: 'unchanged' }
  const dedupeKey = job.companyId ? makeJobDedupeKey(job.companyId, cleaned, job.locationRaw) : null
  if (dedupeKey) {
    const taken = await prisma.job.findFirst({ where: { companyId: job.companyId, dedupeKey, id: { not: job.id } }, select: { id: true } })
    if (taken) return { state: 'clash' }
  }
  await prisma.job.update({ where: { id: job.id }, data: { title: cleaned, ...(dedupeKey ? { dedupeKey } : {}) } })
  return { state: 'written', title: cleaned }
}
