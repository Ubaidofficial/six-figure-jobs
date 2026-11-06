// Make an application kit for one job. The order is what keeps billing honest:
//   1. the résumé and the job must exist, and an existing kit for this résumé is returned without any charge;
//   2. the balance is checked (not spent);
//   3. the model writes the kit; if it fails or answers badly, nothing is charged;
//   4. only then are credits spent, atomically, under an idempotency key tied to this user, job and résumé version,
//      so a double click or a retry charges once;
//   5. the kit is saved.
// So credits are never taken for a kit the user did not receive.

import { getKitCredits } from './config'
import { findKitJob, jobHtmlToText, type KitJob } from './job'
import { KIT_SYSTEM_PROMPT, buildKitPrompt, parseKitContent, type KitContent } from './prompt'

import { callOpenAIChat } from '@/lib/ai/openaiClient'
import { spendCredits } from '@/lib/billing/credits'
import { EntitlementError, requireEntitlement } from '@/lib/billing/entitlement'
import { prisma } from '@/lib/prisma'

export class KitError extends Error {
  constructor(
    readonly code: 'no_resume' | 'job_not_found' | 'ai_unavailable' | 'insufficient_credits',
    readonly status: number,
  ) {
    super(code)
    this.name = 'KitError'
  }
}

export interface KitRecord extends KitContent {
  id: string
  jobId: string
  jobSlug: string
  jobTitle: string
  companyName: string
  applyUrl: string | null
  status: string
  notes: string | null
  createdAt: Date
}

export interface KitDeps {
  findJob: (slug: string) => Promise<KitJob | null>
  ask: (system: string, user: string) => Promise<string>
  cost: number
}

const defaultDeps: KitDeps = {
  findJob: findKitJob,
  ask: (system, user) => callOpenAIChat({ system, user, temperature: 0.4 }),
  cost: 0, // read at call time so the env is honoured
}

const asKit = (row: {
  id: string
  jobId: string
  jobSlug: string
  jobTitle: string
  companyName: string
  applyUrl: string | null
  status: string
  notes: string | null
  createdAt: Date
  coverLetter: string
  bullets: unknown
  keywordGaps: unknown
}): KitRecord => ({
  id: row.id,
  jobId: row.jobId,
  jobSlug: row.jobSlug,
  jobTitle: row.jobTitle,
  companyName: row.companyName,
  applyUrl: row.applyUrl,
  status: row.status,
  notes: row.notes,
  createdAt: row.createdAt,
  coverLetter: row.coverLetter,
  bullets: Array.isArray(row.bullets) ? (row.bullets as string[]) : [],
  keywordGaps: Array.isArray(row.keywordGaps) ? (row.keywordGaps as string[]) : [],
})

export async function generateKit(
  userId: string,
  jobSlug: string,
  overrides: Partial<KitDeps> = {},
): Promise<{ kit: KitRecord; charged: number }> {
  const deps = { ...defaultDeps, ...overrides }
  const cost = deps.cost > 0 ? deps.cost : getKitCredits()

  const resume = await prisma.resume.findUnique({ where: { userId } })
  if (!resume) throw new KitError('no_resume', 400)
  const job = await deps.findJob(jobSlug)
  if (!job) throw new KitError('job_not_found', 404)

  const resumeStamp = String(resume.updatedAt.getTime())
  const existing = await prisma.applicationKit.findUnique({ where: { userId_jobId: { userId, jobId: job.id } } })
  if (existing && existing.resumeStamp === resumeStamp) return { kit: asKit(existing), charged: 0 }

  try {
    await requireEntitlement(userId, { minCredits: cost })
  } catch (err) {
    if (err instanceof EntitlementError && err.code === 'insufficient_credits') throw new KitError('insufficient_credits', 402)
    throw err
  }

  let content: KitContent | null = null
  try {
    content = parseKitContent(
      await deps.ask(
        KIT_SYSTEM_PROMPT,
        buildKitPrompt({
          resume: resume.text,
          jobTitle: job.title,
          company: job.company,
          jobText: jobHtmlToText(job.descriptionHtml),
        }),
      ),
    )
  } catch {
    content = null // provider error or timeout
  }
  if (!content) throw new KitError('ai_unavailable', 502)

  const spent = await spendCredits(userId, 'application-kit', cost, `kit:${userId}:${job.id}:${resumeStamp}`)
  if (!spent.ok) throw new KitError('insufficient_credits', 402)

  const data = {
    jobSlug,
    jobTitle: job.title,
    companyName: job.company,
    applyUrl: job.applyUrl,
    resumeStamp,
    coverLetter: content.coverLetter,
    bullets: content.bullets,
    keywordGaps: content.keywordGaps,
  }
  const saved = await prisma.applicationKit.upsert({
    where: { userId_jobId: { userId, jobId: job.id } },
    create: { userId, jobId: job.id, ...data },
    update: data,
  })
  return { kit: asKit(saved), charged: spent.replayed ? 0 : cost }
}
