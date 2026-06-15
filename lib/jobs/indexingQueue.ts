import { prisma } from '../prisma'
import { buildCanonicalJobUrl } from './indexingNotifications'
import { verifyJobIndexingUpdateSafety, verifyJobIndexingDeleteSafety } from '../indexing/safetyGates'

export async function enqueueJobIndexingUpdate(
  jobId: string,
  reason: string,
  customTitle?: string | null,
): Promise<void> {
  const type = 'URL_UPDATED'
  const dedupeKey = `${jobId}:${type}:pending`

  try {
    // Determine title
    let title = customTitle ?? null
    if (!title) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true },
      })
      title = job?.title ?? null
    }

    const url = buildCanonicalJobUrl({ id: jobId, title })

    // Check safety gates before enqueuing
    const safety = await verifyJobIndexingUpdateSafety(jobId, url)
    if (!safety.safe) {
      console.log(`[indexing:queue] Skip enqueue ${type} for ${jobId}: ${safety.reason}`)
      return
    }

    await prisma.jobIndexingQueue.upsert({
      where: { dedupeKey },
      create: {
        jobId,
        url,
        type,
        reason,
        status: 'pending',
        dedupeKey,
      },
      update: {
        url,
        reason,
        updatedAt: new Date(),
      },
    })
    console.log(`[indexing:queue] Enqueued/Updated ${type} for ${jobId} (url=${url}, reason=${reason})`)
  } catch (error: any) {
    console.error(`[indexing:queue] Failed to enqueue ${type} for ${jobId}:`, error)
  }
}

export async function enqueueJobIndexingDelete(
  jobId: string,
  reason: string,
  customTitle?: string | null,
): Promise<void> {
  const type = 'URL_DELETED'
  const dedupeKey = `${jobId}:${type}:pending`

  try {
    // Determine title
    let title = customTitle ?? null
    if (!title) {
      const job = await prisma.job.findUnique({
        where: { id: jobId },
        select: { title: true },
      })
      title = job?.title ?? null
    }

    const url = buildCanonicalJobUrl({ id: jobId, title })

    // Check safety gates before enqueuing
    const safety = await verifyJobIndexingDeleteSafety(jobId, url)
    if (!safety.safe) {
      console.log(`[indexing:queue] Skip enqueue ${type} for ${jobId}: ${safety.reason}`)
      return
    }

    await prisma.jobIndexingQueue.upsert({
      where: { dedupeKey },
      create: {
        jobId,
        url,
        type,
        reason,
        status: 'pending',
        dedupeKey,
      },
      update: {
        url,
        reason,
        updatedAt: new Date(),
      },
    })
    console.log(`[indexing:queue] Enqueued/Updated ${type} for ${jobId} (url=${url}, reason=${reason})`)
  } catch (error: any) {
    console.error(`[indexing:queue] Failed to enqueue ${type} for ${jobId}:`, error)
  }
}
