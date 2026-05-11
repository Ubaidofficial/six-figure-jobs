import type { JobSlugSource } from './jobSlug'
import { buildJobSlug } from './jobSlug'
import { getSiteUrl } from '../seo/site'
import {
  notifyGoogleIndexing,
  type GoogleIndexingNotificationType,
} from '../googleIndexingApi'

export type IndexableJob = JobSlugSource

type IndexingNotifier = (
  url: string,
  type: GoogleIndexingNotificationType,
) => Promise<unknown>

let notifier: IndexingNotifier = notifyGoogleIndexing

export function setJobIndexingNotifierForTests(nextNotifier: IndexingNotifier): void {
  notifier = nextNotifier
}

export function resetJobIndexingNotifierForTests(): void {
  notifier = notifyGoogleIndexing
}

export function buildCanonicalJobUrl(job: IndexableJob): string {
  return `${getSiteUrl()}/job/${buildJobSlug(job)}`
}

async function notifyJobIndexing(job: IndexableJob, type: GoogleIndexingNotificationType): Promise<void> {
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

