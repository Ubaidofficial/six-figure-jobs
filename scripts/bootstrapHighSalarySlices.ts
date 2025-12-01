// scripts/bootstrapHighSalarySlices.ts
// Generate high-salary role+country slices for target regions.
//
// Usage:
//   npx tsx scripts/bootstrapHighSalarySlices.ts

import { prisma } from '../lib/prisma'
import { ALL_SALARY_ROLES } from '../lib/roles/salaryRoles'
import {
  TARGET_COUNTRIES,
  highSalaryThresholdForCountry,
} from '../lib/seo/regions'

type SliceTask = {
  slug: string
  type: string
  filtersJson: any
  where: any
}

function parseConcurrency(): number {
  const flag = process.argv.find((a) => a.startsWith('--concurrency='))
  const n = flag ? Number(flag.split('=')[1]) : 6
  return Number.isFinite(n) && n > 0 ? Math.min(n, 12) : 6
}

async function main() {
  const concurrency = parseConcurrency()
  console.log(`🔄 Building high-salary slices (concurrency=${concurrency})…`)

  const tasks: SliceTask[] = []
  const salaryBands = [100_000, 200_000, 300_000, 400_000]

  for (const country of TARGET_COUNTRIES) {
    const threshold = highSalaryThresholdForCountry(country.code)

    for (const role of ALL_SALARY_ROLES) {
      for (const band of salaryBands) {
        const minAnnual = Math.max(threshold, band)
        const bandSlug =
          band === 100_000
            ? '100k-plus'
            : band === 200_000
            ? '200k-plus'
            : band === 300_000
            ? '300k-plus'
            : '400k-plus'

        const slug = `jobs/${role.slug}/${country.code.toLowerCase()}/${bandSlug}`

        tasks.push({
          slug,
          type: 'role-country',
          filtersJson: JSON.stringify({
            roleSlugs: [role.slug],
            countryCode: country.code,
            minAnnual,
            isHundredKLocal: true,
          }),
          where: {
            isExpired: false,
            roleSlug: { contains: role.slug },
            countryCode: country.code,
            OR: [
              { maxAnnual: { gte: BigInt(minAnnual) } },
              { minAnnual: { gte: BigInt(minAnnual) } },
              { isHighSalary: true },
              { isHundredKLocal: true },
            ],
          },
        })
      }
    }
  }

  // Remote-only slices (global)
  for (const role of ALL_SALARY_ROLES) {
    for (const band of salaryBands) {
      const minAnnual = band
      const bandSlug =
        band === 100_000
          ? '100k-plus'
          : band === 200_000
          ? '200k-plus'
          : band === 300_000
          ? '300k-plus'
          : '400k-plus'

      const slug = `jobs/${role.slug}/remote/${bandSlug}`

      tasks.push({
        slug,
        type: 'role-remote',
        filtersJson: JSON.stringify({
          roleSlugs: [role.slug],
          remoteMode: 'remote',
          minAnnual,
          isHundredKLocal: true,
        }),
        where: {
          isExpired: false,
          roleSlug: { contains: role.slug },
          AND: [
            {
              OR: [
                { remote: true },
                { remoteMode: 'remote' },
                { remoteRegion: { not: null } },
              ],
            },
            {
              OR: [
                { maxAnnual: { gte: BigInt(minAnnual) } },
                { minAnnual: { gte: BigInt(minAnnual) } },
                { isHighSalary: true },
                { isHundredKLocal: true },
              ],
            },
          ],
        },
      })
    }
  }

  console.log(`🧮 Calculating counts for ${tasks.length} slices…`)

  let processed = 0
  await runWithConcurrency(tasks, concurrency, async (task) => {
    const count = await prisma.job.count({ where: task.where })
    processed++
    if (count === 0) return

    await prisma.jobSlice.upsert({
      where: { slug: task.slug },
      update: {
        type: task.type,
        filtersJson: task.filtersJson,
        jobCount: count,
      },
      create: {
        slug: task.slug,
        type: task.type,
        filtersJson: task.filtersJson,
        jobCount: count,
      },
    })

    if (processed % 200 === 0) {
      console.log(`   …${processed}/${tasks.length} processed`)
    }
  })

  console.log('✅ Done.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

async function runWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
) {
  const queue = [...items]
  const runners: Promise<void>[] = []

  const runNext = async (): Promise<void> => {
    const item = queue.shift()
    if (!item) return
    try {
      await fn(item)
    } catch (err) {
      console.error(err)
    }
    await runNext()
  }

  for (let i = 0; i < Math.min(limit, items.length); i++) {
    runners.push(runNext())
  }

  await Promise.all(runners)
}
