import type { JobSlugSource } from './jobSlug'
import { buildJobSlug } from './jobSlug'
import { getSiteUrl } from '../seo/site'
import {
  hasIndexingCredentials,
  notifyUrls,
  type IndexingRequestType,
} from '../indexing/googleIndexingClient'

export type IndexableJob = JobSlugSource

type IndexingNotifier = (
  url: string,
  type: IndexingRequestType,
) => Promise<unknown>

async function defaultNotifier(url: string, type: IndexingRequestType): Promise<unknown> {
  if (!hasIndexingCredentials()) {
    return { skipped: true, reason: 'missing_credentials' }
  }

  const [result] = await notifyUrls([url], { type, concurrency: 1 })
  if (!result?.success) {
    throw new Error(result?.error || `Indexing notification failed for ${url}`)
  }

  return result
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
