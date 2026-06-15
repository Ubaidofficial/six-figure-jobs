// scripts/process-google-indexing-queue.ts
// Background worker to process the job indexing queue.
//
// Usage:
//   npx tsx scripts/process-google-indexing-queue.ts
//
// Env vars:
//   INDEXING_API_DRY_RUN   — "0" to actually publish to Google (default: 1, dry run)
//   INDEXING_API_MAX_URLS  — max URLs to process in this run (default: 200)
//   INDEXING_API_DAILY_LIMIT — internal safety cap (default: 180)

import { prisma } from '../lib/prisma'
import {
  getAccessToken,
  publishUrl,
  type IndexingRequestType,
} from '../lib/indexing/googleIndexingClient'
import {
  verifyJobIndexingUpdateSafety,
  verifyJobIndexingDeleteSafety,
} from '../lib/indexing/safetyGates'

// Internal safety cap below the common/default onboarding quota.
// Note: This is an internal cap, not a guaranteed universal Google quota.
// The actual quota must be verified in the Google Cloud Console,
// and higher usage requires requesting approval from Google.
const DAILY_LIMIT = Math.max(1, Number(process.env.INDEXING_API_DAILY_LIMIT || '180'))
const MAX_URLS = Math.max(1, Number(process.env.INDEXING_API_MAX_URLS || '200'))
const DRY_RUN = process.env.INDEXING_API_DRY_RUN !== '0'

async function main() {
  console.log(`[indexing:worker] Starting indexing queue processor...`)
  console.log(`[indexing:worker] DRY_RUN=${DRY_RUN}`)
  console.log(`[indexing:worker] DAILY_LIMIT=${DAILY_LIMIT} (internal safety cap; actual Google Cloud Console quota must be verified)`)
  console.log(`[indexing:worker] MAX_URLS=${MAX_URLS}`)

  // 1. Calculate quota usage in last 24 hours
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const sentCount = await prisma.jobIndexingQueue.count({
    where: {
      status: 'sent',
      sentAt: {
        gte: twentyFourHoursAgo,
      },
    },
  })

  console.log(`[indexing:worker] Sent in last 24 hours: ${sentCount}`)

  if (sentCount >= DAILY_LIMIT) {
    console.log(
      `[indexing:worker] Daily indexing limit of ${DAILY_LIMIT} reached (already sent ${sentCount} in the last 24h). Stopping processing.`
    )
    console.log(
      `[indexing:worker] Note: Actual quota must be verified in Google Cloud Console and higher usage requires Google approval.`
    )
    return
  }

  const remainingQuota = DAILY_LIMIT - sentCount
  const batchLimit = Math.min(MAX_URLS, remainingQuota)
  console.log(`[indexing:worker] Remaining quota: ${remainingQuota}. Batch limit: ${batchLimit}`)

  // 2. Query pending records
  const pendingRecords = await prisma.jobIndexingQueue.findMany({
    where: {
      status: 'pending',
      OR: [
        { notBefore: null },
        { notBefore: { lte: new Date() } },
      ],
    },
    orderBy: {
      createdAt: 'asc',
    },
    take: batchLimit,
  })

  console.log(`[indexing:worker] Found ${pendingRecords.length} pending records to process.`)

  if (pendingRecords.length === 0) {
    console.log(`[indexing:worker] No pending records to process. Exiting.`)
    return
  }

  // Summary counters
  const summary = {
    pending: 0,
    sent: 0,
    failed: 0,
    skipped: 0,
  }

  if (DRY_RUN) {
    console.log(`[indexing:worker] --- DRY RUN MODE ---`)
    for (const record of pendingRecords) {
      console.log(
        `[indexing:worker] [dry-run] Would notify Google: id=${record.id} type=${record.type} url=${record.url} reason=${record.reason}`
      )
      summary.sent++
    }
    console.log(`[indexing:worker] Dry-run processed count: ${summary.sent}`)
    console.log(`[indexing:worker] Run in non-dry-run mode by setting INDEXING_API_DRY_RUN=0`)
    return
  }

  // Real execution mode
  let token: string
  try {
    token = await getAccessToken()
  } catch (error: any) {
    console.error(`[indexing:worker] Failed to retrieve Google credentials/access token:`, error.message)
    process.exitCode = 1
    return
  }

  for (const record of pendingRecords) {
    console.log(`[indexing:worker] Processing record id=${record.id} url=${record.url} type=${record.type}`)

    // Re-verify safety gates before submitting
    let safety: { safe: boolean; reason?: string }
    if (record.type === 'URL_UPDATED') {
      safety = await verifyJobIndexingUpdateSafety(record.jobId, record.url)
    } else if (record.type === 'URL_DELETED') {
      safety = await verifyJobIndexingDeleteSafety(record.jobId, record.url)
    } else {
      safety = { safe: false, reason: `unsupported_type_${record.type}` }
    }

    if (!safety.safe) {
      const processedAt = new Date()
      await prisma.jobIndexingQueue.update({
        where: { id: record.id },
        data: {
          status: 'skipped',
          lastError: `Safety gate rejected: ${safety.reason}`,
          dedupeKey: `${record.jobId}:${record.type}:skipped:${processedAt.getTime()}`,
          updatedAt: processedAt,
        },
      })
      console.log(`[indexing:worker] Skipped URL ${record.url}: ${safety.reason}`)
      summary.skipped++
      continue
    }

    // Submit to Google
    try {
      await publishUrl(record.url, token, record.type as IndexingRequestType)

      const processedAt = new Date()
      await prisma.jobIndexingQueue.update({
        where: { id: record.id },
        data: {
          status: 'sent',
          attempts: record.attempts + 1,
          googleResponse: 'Success',
          sentAt: processedAt,
          dedupeKey: `${record.jobId}:${record.type}:sent:${processedAt.getTime()}`,
          updatedAt: processedAt,
        },
      })
      console.log(`[indexing:worker] Successfully notified Google Indexing API: type=${record.type} url=${record.url}`)
      summary.sent++
    } catch (error: any) {
      const status = error.status
      const isTransient = !status || status === 429 || status === 503 || status >= 500

      if (isTransient && record.attempts + 1 < 3) {
        const attempts = record.attempts + 1
        const backoffMinutes = Math.pow(2, attempts) * 2 // 4, 8 minutes backoff
        const notBefore = new Date(Date.now() + backoffMinutes * 60 * 1000)

        await prisma.jobIndexingQueue.update({
          where: { id: record.id },
          data: {
            attempts,
            lastError: error.message || String(error),
            notBefore,
            updatedAt: new Date(),
          },
        })
        console.log(
          `[indexing:worker] Transient error for ${record.url} (status=${status || 'network'}). Rescheduling in ${backoffMinutes}m. Error: ${error.message}`
        )
        summary.pending++
      } else {
        const processedAt = new Date()
        const reason = isTransient ? 'exceeded_max_retries' : 'permanent_error'
        await prisma.jobIndexingQueue.update({
          where: { id: record.id },
          data: {
            status: 'failed',
            attempts: record.attempts + 1,
            lastError: `Failed due to ${reason}: ${error.message || String(error)}`,
            dedupeKey: `${record.jobId}:${record.type}:failed:${processedAt.getTime()}`,
            updatedAt: processedAt,
          },
        })
        console.log(
          `[indexing:worker] Permanent failure for ${record.url} (status=${status || 'unknown'}). Error: ${error.message}`
        )
        summary.failed++
      }
    }
  }

  console.log(`[indexing:worker] --- Run Summary ---`)
  console.log(`[indexing:worker] Sent:    ${summary.sent}`)
  console.log(`[indexing:worker] Failed:  ${summary.failed}`)
  console.log(`[indexing:worker] Skipped: ${summary.skipped}`)
  console.log(`[indexing:worker] Retrying:${summary.pending}`)
}

main().catch((error) => {
  console.error(`[indexing:worker] Fatal execution error:`, error)
  process.exitCode = 1
})
