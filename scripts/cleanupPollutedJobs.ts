import { format as __format } from 'node:util'
import { prisma } from '../lib/prisma'
import {
  cleanJobDescriptionHtml,
  findJobDescriptionNoiseMatches,
  type JobDescriptionNoiseId,
} from '../lib/jobs/descriptionCleaning'
import { markJobExpired } from '../lib/jobs/expiry'
import { notifyJobDeletedForIndexing } from '../lib/jobs/indexingNotifications'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

type Options = {
  write: boolean
  limit: number
  batchSize: number
  sourceFilter: string[] | null
}

type JobRow = {
  id: string
  title: string
  source: string
  url: string | null
  descriptionHtml: string | null
}

type SourceStats = {
  scanned: number
  polluted: number
  repairable: number
  expired: number
  repaired: number
}

type SampleRow = {
  id: string
  title: string
  source: string
  url: string | null
  noiseMatches: JobDescriptionNoiseId[]
}

function parseOptions(): Options {
  const args = process.argv.slice(2)

  const flag = (name: string): string | null => {
    const exactIdx = args.indexOf(name)
    if (exactIdx !== -1) return args[exactIdx + 1] ?? null
    const withEquals = args.find((arg) => arg.startsWith(`${name}=`))
    return withEquals ? withEquals.slice(name.length + 1) : null
  }

  const parsePositiveInt = (value: string | null, fallback: number, max: number): number => {
    if (!value) return fallback
    const parsed = Number(value)
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback
    return Math.min(Math.floor(parsed), max)
  }

  const sourceArg = String(flag('--source') || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  return {
    write: args.includes('--write'),
    limit: parsePositiveInt(flag('--limit'), 5000, 50_000),
    batchSize: parsePositiveInt(flag('--batch-size'), 200, 1000),
    sourceFilter: sourceArg.length > 0 ? sourceArg : null,
  }
}

function getWhere(options: Options) {
  return {
    isExpired: false,
    descriptionHtml: { not: null },
    ...(options.sourceFilter?.length
      ? {
          source: {
            in: options.sourceFilter,
          },
        }
      : {}),
  }
}

function getSourceStats(map: Map<string, SourceStats>, source: string): SourceStats {
  const existing = map.get(source)
  if (existing) return existing

  const created: SourceStats = {
    scanned: 0,
    polluted: 0,
    repairable: 0,
    expired: 0,
    repaired: 0,
  }
  map.set(source, created)
  return created
}

function changedDescription(before: string | null, after: string | null): boolean {
  return String(before || '').trim() !== String(after || '').trim()
}

async function loadBatch(cursor: string | null, options: Options): Promise<JobRow[]> {
  return prisma.job.findMany({
    where: getWhere(options),
    orderBy: { id: 'asc' },
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    take: options.batchSize,
    select: {
      id: true,
      title: true,
      source: true,
      url: true,
      descriptionHtml: true,
    },
  })
}

async function expireJob(job: JobRow): Promise<void> {
  try {
    await markJobExpired(job.id)
    return
  } catch (error: any) {
    const missingValidThrough =
      error?.code === 'P2022' && String(error?.meta?.column || '').includes('Job.validThrough')
    if (!missingValidThrough) throw error

    const today = new Date()
    await prisma.$executeRaw`
      UPDATE "Job"
      SET "isExpired" = true,
          "expiresAt" = ${today},
          "updatedAt" = ${today}
      WHERE id = ${job.id}
    `
    await notifyJobDeletedForIndexing({
      id: job.id,
      title: job.title,
      source: job.source,
    })
  }
}

async function main() {
  const options = parseOptions()
  __slog(
    `[cleanup-polluted-jobs] mode=%s limit=%d batchSize=%d source=%s`,
    options.write ? 'write' : 'dry-run',
    options.limit,
    options.batchSize,
    options.sourceFilter?.join(',') || 'all',
  )

  const sourceStats = new Map<string, SourceStats>()
  const pollutedSamples: SampleRow[] = []

  let cursor: string | null = null
  let scanned = 0
  let polluted = 0
  let repairable = 0
  let expired = 0
  let repaired = 0

  while (scanned < options.limit) {
    const batch = await loadBatch(cursor, options)
    if (batch.length === 0) break

    for (const job of batch) {
      if (scanned >= options.limit) break
      scanned += 1
      cursor = job.id

      const stats = getSourceStats(sourceStats, job.source)
      stats.scanned += 1

      const descriptionHtml = String(job.descriptionHtml || '')
      const cleanedDescriptionHtml = cleanJobDescriptionHtml(descriptionHtml) || null
      const noiseMatches = findJobDescriptionNoiseMatches(descriptionHtml)
      const isPolluted = noiseMatches.length > 0 && !cleanedDescriptionHtml
      const isRepairable =
        !isPolluted && cleanedDescriptionHtml != null && changedDescription(descriptionHtml, cleanedDescriptionHtml)

      if (isPolluted) {
        polluted += 1
        stats.polluted += 1
        if (pollutedSamples.length < 25) {
          pollutedSamples.push({
            id: job.id,
            title: job.title,
            source: job.source,
            url: job.url,
            noiseMatches,
          })
        }

        if (options.write) {
          await expireJob(job)
          expired += 1
          stats.expired += 1
        }
        continue
      }

      if (isRepairable && cleanedDescriptionHtml) {
        repairable += 1
        stats.repairable += 1
        if (options.write) {
          await prisma.$executeRaw`
            UPDATE "Job"
            SET "descriptionHtml" = ${cleanedDescriptionHtml},
                "updatedAt" = ${new Date()}
            WHERE id = ${job.id}
          `
          repaired += 1
          stats.repaired += 1
        }
      }
    }
  }

  __slog('')
  __slog(
    `[cleanup-polluted-jobs] scanned=%d polluted=%d repairable=%d expired=%d repaired=%d`,
    scanned,
    polluted,
    repairable,
    expired,
    repaired,
  )

  if (sourceStats.size > 0) {
    __slog('\nBy source:')
    for (const [source, stats] of Array.from(sourceStats.entries()).sort((a, b) => {
      const affectedA = a[1].polluted + a[1].repairable
      const affectedB = b[1].polluted + b[1].repairable
      return affectedB - affectedA || b[1].scanned - a[1].scanned
    })) {
      if (stats.polluted === 0 && stats.repairable === 0) continue
      __slog(
        '- %s scanned=%d polluted=%d repairable=%d expired=%d repaired=%d',
        source,
        stats.scanned,
        stats.polluted,
        stats.repairable,
        stats.expired,
        stats.repaired,
      )
    }
  }

  if (pollutedSamples.length > 0) {
    __slog('\nPolluted samples:')
    for (const sample of pollutedSamples) {
      __slog(
        '- [%s] %s (%s) noise=%s %s',
        sample.source,
        sample.title,
        sample.id,
        sample.noiseMatches.join(','),
        sample.url || '',
      )
    }
  }
}

main()
  .catch((error) => {
    __serr('[cleanup-polluted-jobs] error:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
