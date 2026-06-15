import type { JobSlugSource } from './jobSlug'
import { buildJobSlug, parseJobSlugParam } from './jobSlug'
import { getSiteUrl } from '../seo/site'
import { prisma } from '../prisma'
import { type IndexingRequestType } from '../indexing/googleIndexingClient'
import { enqueueJobIndexingUpdate, enqueueJobIndexingDelete } from './indexingQueue'

export type IndexableJob = JobSlugSource

type IndexingNotifier = (
  url: string,
  type: IndexingRequestType,
) => Promise<unknown>

async function defaultNotifier(url: string, type: IndexingRequestType): Promise<unknown> {
  try {
    const pathname = new URL(url).pathname
    const slug = pathname.split('/').pop() || ''
    const { jobId, shortId } = parseJobSlugParam(slug)

    let resolvedId = jobId
    if (!resolvedId && shortId) {
      const job = await prisma.job.findFirst({
        where: { shortId },
        select: { id: true },
      })
      resolvedId = job?.id ?? null
    }

    if (!resolvedId) {
      console.error(`[indexing:notifier] Could not resolve job ID from URL: ${url}`)
      return { skipped: true, reason: 'unresolved_job_id' }
    }

    if (type === 'URL_UPDATED') {
      await enqueueJobIndexingUpdate(resolvedId, 'pipeline')
    } else {
      await enqueueJobIndexingDelete(resolvedId, 'pipeline')
    }

    return { ok: true }
  } catch (error: any) {
    console.error(`[indexing:notifier] Failed to enqueue URL ${url}:`, error)
    throw error
  }
}

let notifier: IndexingNotifier = defaultNotifier

export function setJobIndexingNotifierForTests(nextNotifier: IndexingNotifier): void {
  notifier = nextNotifier
}

export function resetJobIndexingNotifierForTests(): void {
  notifier = defaultNotifier
}


export function buildCanonicalJobUrl(job: IndexableJob): string {
  return `${getSiteUrl()}/job/${buildJobSlug(job)}`
}

async function notifyJobIndexing(job: IndexableJob, type: IndexingRequestType): Promise<void> {
  const url = buildCanonicalJobUrl(job)
  try {
    await notifier(url, type)
  } catch (error) {
    console.error(
      `[GoogleIndexingAPI] Notification failed type=${type} url=${url}:`,
      error instanceof Error ? error.message : String(error),
    )
  }
}

export function notifyJobInsertedForIndexing(job: IndexableJob): Promise<void> {
  return notifyJobIndexing(job, 'URL_UPDATED')
}

export function notifyJobDeletedForIndexing(job: IndexableJob): Promise<void> {
  return notifyJobIndexing(job, 'URL_DELETED')
}
