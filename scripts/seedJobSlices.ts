// scripts/seedJobSlices.ts
/**
 * Seed high-value JobSlice records for programmatic SEO.
 *
 * - Creates band-only slices: /jobs/100k-plus, /jobs/200k-plus, /jobs/300k-plus, /jobs/400k-plus
 * - Creates band + role + country slices when there are enough jobs:
 *     /jobs/100k-plus/software-engineer/us
 *
 * Run with:
 *   npx tsx scripts/seedJobSlices.ts
 */

import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'
import { countryCodeToSlug } from '../lib/seo/countrySlug'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + "\n")
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + "\n")


const prisma = new PrismaClient()

const SALARY_BANDS = [100_000, 200_000, 300_000, 400_000]
const MIN_JOBS_FOR_SLICE = 3

type Band = (typeof SALARY_BANDS)[number]

type JobLite = {
  roleSlug: string | null
  countryCode: string | null
  minAnnual: bigint | null
  maxAnnual: bigint | null
  isHundredKLocal: boolean
}

function humanize(str: string): string {
  return str
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function countryNameFromCode(code: string): string {
  const upper = code.toUpperCase()
  const map: Record<string, string> = {
    US: 'United States',
    CA: 'Canada',
    GB: 'United Kingdom',
    DE: 'Germany',
    ES: 'Spain',
    IE: 'Ireland',
    AU: 'Australia',
    IN: 'India',
  }
  return map[upper] ?? upper
}

function qualifiesForBand(job: JobLite, band: Band): boolean {
  if (job.isHundredKLocal) return true

  if (job.minAnnual != null && job.maxAnnual != null) {
    const b = BigInt(band)
    return job.minAnnual >= b && job.maxAnnual >= b
  }

  return false
}

async function seedBandBaseSlice(band: Band) {
  const bandSlug = `${band / 1000}k-plus`
  const slug = `jobs/${bandSlug}`

  const filters = {
    minAnnual: band,
  }

  const title = `$${band / 1000}k+ tech jobs from top companies`
  const description =
    `Curated $${band / 1000}k+ tech and software jobs from ATS-powered company boards.`

  const slice = await prisma.jobSlice.upsert({
    where: { slug },
    update: {
      filtersJson: JSON.stringify(filters),
      title,
      description,
      h1: title,
    },
    create: {
      slug,
      type: 'band',
      filtersJson: JSON.stringify(filters),
      jobCount: 0,
      title,
      description,
      h1: title,
    },
  })

  __slog('✅ Base slice upserted:', slice.slug)
}

async function seedRoleCountrySlicesForBand(band: Band) {
  __slog(`\n▶ Seeding role+country slices for band ${band}...`)

  const jobs = await prisma.job.findMany({
    where: {
      isExpired: false,
      OR: [
        {
          AND: [
            { minAnnual: { gte: BigInt(100_000) } },
            { maxAnnual: { gte: BigInt(100_000) } },
          ],
        },
        { isHundredKLocal: true },
      ],
      roleSlug: { not: null },
      countryCode: { not: null },
    },
    select: {
      roleSlug: true,
      countryCode: true,
      minAnnual: true,
      maxAnnual: true,
      isHundredKLocal: true,
    },
  })

  type ComboKey = string
  const counts: Record<ComboKey, number> = {}

  for (const job of jobs as JobLite[]) {
    if (!job.roleSlug || !job.countryCode) continue
    if (!qualifiesForBand(job, band)) continue

    const key = `${job.roleSlug}|${job.countryCode.toUpperCase()}`
    counts[key] = (counts[key] ?? 0) + 1
  }

  const entries = Object.entries(counts).filter(
    ([, count]) => count >= MIN_JOBS_FOR_SLICE
  )

  if (entries.length === 0) {
    __slog(`  (No combos with >= ${MIN_JOBS_FOR_SLICE} jobs for band ${band})`)
    return
  }

  __slog(
    `  Found ${entries.length} (role,country) combos with >= ${MIN_JOBS_FOR_SLICE} jobs for band ${band}`
  )

	  for (const [key, jobCount] of entries) {
	    const [roleSlug, countryCode] = key.split('|')
	    const bandSlug = `${band / 1000}k-plus`
	    const countrySlug = countryCodeToSlug(countryCode) ?? countryCode.toLowerCase()
	    const slug = `jobs/${bandSlug}/${roleSlug}/${countrySlug}`

    const filters = {
      minAnnual: band,
      roleSlugs: [roleSlug],
      countryCode,
    }

    const roleLabel = humanize(roleSlug)
    const countryLabel = countryNameFromCode(countryCode)
    const title = `$${band / 1000}k+ ${roleLabel} Jobs in ${countryLabel}`
    const description = `Browse curated $${band / 1000}k+ ${roleLabel} jobs in ${countryLabel} from top tech companies hiring now.`

    await prisma.jobSlice.upsert({
      where: { slug },
      update: {
        filtersJson: JSON.stringify(filters),
        jobCount,
        title,
        description,
        h1: title,
      },
      create: {
        slug,
        type: 'band-role-country',
        filtersJson: JSON.stringify(filters),
        jobCount,
        title,
        description,
        h1: title,
      },
    })

    __slog(`  • Upserted slice: ${slug} (jobs=${jobCount})`)
  }
}

async function main() {
  __slog('🚀 Seeding JobSlices for programmatic SEO...')

  for (const band of SALARY_BANDS) {
    __slog(`\n=== Band $${band / 1000}k+ ===`)
    await seedBandBaseSlice(band)
    await seedRoleCountrySlicesForBand(band)
  }

  __slog('\n✅ Done seeding JobSlices.')
}

main()
  .catch((err) => {
    __serr('Error seeding job slices:', err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
