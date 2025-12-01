// scripts/generateJobSlices.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Avoid thin content pages
const MIN_JOBS_FOR_SLICE = 5

// Salary bands we support
const SALARY_BANDS = [100_000, 200_000, 300_000, 400_000]

// Treat a job as ">= band" if either:
// - we have a normalized maxAnnual >= band, OR
// - it's explicitly flagged as isHundredKLocal (fallback)
function bandWhere(band: number) {
  return {
    OR: [
      { maxAnnual: { not: null, gte: BigInt(band) } },
      { isHundredKLocal: true },
    ],
  }
}

async function main() {
  console.log('Generating JobSlices with SEO-optimized slugs…')

  // Start clean so we don't mix old slug patterns with new ones
  await prisma.jobSlice.deleteMany()
  console.log('Cleared existing JobSlices.')

  await generateGlobalSalarySlices()
  await generateRoleCountrySlices()
  await generateCountryAllRolesSlices()

  console.log('JobSlices generated.')
}

/* -------------------------------------------------------
   1) GLOBAL SALARY PAGES
   /jobs/100k-plus
   /jobs/200k-plus
------------------------------------------------------- */
async function generateGlobalSalarySlices() {
  for (const band of SALARY_BANDS) {
    const where = bandWhere(band)

    const count = await prisma.job.count({ where })

    if (count < MIN_JOBS_FOR_SLICE) continue

    const bandSlug = `${band / 1000}k-plus` // "100k-plus"
    const slug = `jobs/${bandSlug}`         // "jobs/100k-plus"

    await upsertSlice({
      slug,
      type: 'salary',
      filters: {
        minAnnual: band,
      },
      jobCount: count,
    })
  }
}

/* -------------------------------------------------------
   2) ROLE + COUNTRY + SALARY
   /jobs/100k-plus/data-scientist/us
   /jobs/200k-plus/software-engineer/ca
------------------------------------------------------- */
async function generateRoleCountrySlices() {
  for (const band of SALARY_BANDS) {
    const where = bandWhere(band)

    const rows = await prisma.job.groupBy({
      by: ['roleSlug', 'countryCode'],
      where: {
        roleSlug: { not: null },
        countryCode: { not: null },
        ...where,
      },
      _count: { _all: true },
    })

    for (const row of rows) {
      const role = row.roleSlug as string | null
      const countryCode = row.countryCode as string | null
      if (!role || !countryCode) continue
      if (row._count._all < MIN_JOBS_FOR_SLICE) continue

      const bandSlug = `${band / 1000}k-plus` // "100k-plus"
      const countrySlug = countryCode.toLowerCase() // "US" -> "us"
      const slug = `jobs/${bandSlug}/${role}/${countrySlug}`
      // e.g. "jobs/100k-plus/data-scientist/us"

      await upsertSlice({
        slug,
        type: 'role-country',
        filters: {
          roleSlugs: [role],
          countryCode,
          minAnnual: band,
        },
        jobCount: row._count._all,
      })
    }
  }
}

/* -------------------------------------------------------
   3) COUNTRY ALL-ROLES + SALARY
   /jobs/100k-plus/all-roles/us
   /jobs/200k-plus/all-roles/ca
------------------------------------------------------- */
async function generateCountryAllRolesSlices() {
  for (const band of SALARY_BANDS) {
    const where = bandWhere(band)

    const rows = await prisma.job.groupBy({
      by: ['countryCode'],
      where: {
        countryCode: { not: null },
        ...where,
      },
      _count: { _all: true },
    })

    for (const row of rows) {
      const countryCode = row.countryCode as string | null
      if (!countryCode) continue
      if (row._count._all < MIN_JOBS_FOR_SLICE) continue

      const bandSlug = `${band / 1000}k-plus`
      const countrySlug = countryCode.toLowerCase()
      const slug = `jobs/${bandSlug}/all-roles/${countrySlug}`
      // e.g. "jobs/100k-plus/all-roles/us"

      await upsertSlice({
        slug,
        type: 'country-salary-all-roles',
        filters: {
          countryCode,
          minAnnual: band,
        },
        jobCount: row._count._all,
      })
    }
  }
}

/* -------------------------------------------------------
   UPSERT HELPER
------------------------------------------------------- */
async function upsertSlice(args: {
  slug: string
  type: string
  filters: any
  jobCount: number
}) {
  const { slug, type, filters, jobCount } = args

  await prisma.jobSlice.upsert({
    where: { slug },
    create: {
      slug,
      type,
      filtersJson: JSON.stringify(filters),
      jobCount,
    },
    update: {
      type,
      filtersJson: JSON.stringify(filters),
      jobCount,
    },
  })

  console.log(`→ upserted slice ${slug} (${jobCount} jobs)`)
}

/* -------------------------------------------------------
   RUN SCRIPT
------------------------------------------------------- */
main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
