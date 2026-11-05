// scripts/freehire-reload.ts
// Replaces the site's jobs with freehire jobs posted since a date. Jobs only: companies, slices,
// admin users, config and feedback are untouched. Nothing is hard-deleted — old jobs are expired
// (isExpired = true), which the site already treats as gone, and their ids are saved so the step
// can be undone.
//
//   tsx scripts/freehire-reload.ts plan    --since 2026-11-01              read-only: counts + freehire dry run
//   tsx scripts/freehire-reload.ts reload  --since 2026-11-01 --ids-file f  expire every active job, then load
//   tsx scripts/freehire-reload.ts restore --ids-file f                    un-expire exactly the saved ids
import { readFile, writeFile } from 'node:fs/promises'

import { prisma } from '../lib/prisma'
import { collectFreehireJobs, ingestFreehireJobs } from '../lib/scrapers/freehire'

const BATCH = 5000

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`)
  return i > -1 ? process.argv[i + 1] : undefined
}

function parseSince(): Date {
  const raw = arg('since')
  const since = raw ? new Date(raw) : null
  if (!since || Number.isNaN(since.getTime())) throw new Error('--since YYYY-MM-DD is required')
  return since
}

function idsFile(): string {
  const file = arg('ids-file')
  if (!file) throw new Error('--ids-file is required')
  return file
}

async function setExpired(ids: string[], isExpired: boolean) {
  for (let i = 0; i < ids.length; i += BATCH) {
    await prisma.job.updateMany({ where: { id: { in: ids.slice(i, i + BATCH) } }, data: { isExpired } })
  }
}

async function plan(since: Date) {
  const [total, active] = await Promise.all([prisma.job.count(), prisma.job.count({ where: { isExpired: false } })])
  const bySource = await prisma.job.groupBy({ by: ['source'], where: { isExpired: false }, _count: true })
  console.log(`jobs total=${total} active=${active}`)
  for (const s of bySource.sort((a, b) => b._count - a._count)) console.log(`  ${s.source}: ${s._count}`)

  const { markets, inputs, errors, unmappable } = await collectFreehireJobs({ since })
  console.log(`\nfreehire jobs posted since ${since.toISOString()} that would be loaded (dry run):`)
  for (const m of markets) console.log(`  ${m.currency}: available=${m.available} fetched=${m.fetched} mappable=${m.mappable} gateRejected=${m.gateRejected}`)
  console.log(`  total unique publishable jobs=${inputs.length} (unpublishable/stale skipped=${unmappable})`)
  if (errors.length > 0) {
    console.error(`INCOMPLETE — freehire errors: ${errors.join('; ')}`)
    process.exitCode = 1
  }
}

async function restore(file: string) {
  const ids: string[] = JSON.parse(await readFile(file, 'utf8'))
  await setExpired(ids, false)
  console.log(`restored ${ids.length} jobs`)
}

async function reload(since: Date, file: string) {
  // 1. Collect everything from freehire FIRST. If that is incomplete, nothing has been touched yet.
  const { inputs, markets, errors } = await collectFreehireJobs({ since })
  for (const m of markets) console.log(`  ${m.currency}: available=${m.available} fetched=${m.fetched} mappable=${m.mappable}`)
  if (errors.length > 0 || inputs.length === 0) {
    console.error(`Aborting BEFORE changing any job: ${errors.length > 0 ? errors.join('; ') : 'freehire returned no publishable jobs'}`)
    process.exitCode = 1
    return
  }
  console.log(`collected ${inputs.length} unique publishable freehire jobs`)

  // 2. Save the ids, then expire.
  const ids = (await prisma.job.findMany({ where: { isExpired: false }, select: { id: true } })).map((j) => j.id)
  await writeFile(file, JSON.stringify(ids)) // saved BEFORE anything changes
  console.log(`expiring ${ids.length} active jobs (ids saved to ${file})`)
  await setExpired(ids, true)

  // 3. Load from memory (no further freehire requests).
  const stats = await ingestFreehireJobs(inputs)
  console.log(`freehire load: created=${stats.created} updated=${stats.updated} skipped=${stats.skipped}`)

  // Safety net: never leave the site empty because the load failed.
  if (stats.created + stats.updated === 0) {
    console.error('Load produced no jobs — restoring the previous jobs.')
    await setExpired(ids, false)
    process.exitCode = 1
  }
}

async function main() {
  const mode = process.argv[2]
  if (mode === 'plan') await plan(parseSince())
  else if (mode === 'reload') await reload(parseSince(), idsFile())
  else if (mode === 'restore') await restore(idsFile())
  else throw new Error('usage: freehire-reload.ts plan|reload|restore')
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
