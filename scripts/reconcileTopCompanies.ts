import { format as __format } from 'node:util'
import { PrismaClient } from '@prisma/client'

const __slog = (...args: any[]) => process.stdout.write(__format(...args) + '\n')
const __serr = (...args: any[]) => process.stderr.write(__format(...args) + '\n')

const prisma = new PrismaClient()

type CompanyUpdate = {
  slug: string
  data: Record<string, string | null>
}

type CompanyMerge = {
  sourceSlug: string
  targetSlug: string
  targetData?: Record<string, string | null>
}

const DIRECT_UPDATES: CompanyUpdate[] = [
  {
    slug: 'verkada-inc',
    data: {
      name: 'Verkada',
      slug: 'verkada',
      website: 'https://verkada.com',
      atsProvider: 'greenhouse',
      atsUrl: 'https://boards.greenhouse.io/verkada',
      atsSlug: 'verkada',
    },
  },
  {
    slug: 'samsara',
    data: {
      atsProvider: 'greenhouse',
      atsUrl: 'https://boards.greenhouse.io/samsara',
      atsSlug: 'samsara',
      website: 'https://samsara.com',
    },
  },
  {
    slug: 'hims-and-hers',
    data: {
      atsProvider: null,
      atsUrl: null,
      atsSlug: null,
    },
  },
  {
    slug: 'klarna',
    data: {
      atsProvider: null,
      atsUrl: null,
      atsSlug: null,
    },
  },
  {
    slug: 'mistral-ai',
    data: {
      atsProvider: null,
      atsUrl: null,
      atsSlug: null,
    },
  },
]

const MERGES: CompanyMerge[] = [
  {
    sourceSlug: '1password-2',
    targetSlug: '1password',
    targetData: {
      name: '1Password',
      website: 'https://1password.com/jobs/',
      atsProvider: 'ashby',
      atsUrl: 'https://jobs.ashbyhq.com/1password',
      atsSlug: '1password',
    },
  },
  {
    sourceSlug: 'linearapp',
    targetSlug: 'linear',
    targetData: {
      name: 'Linear',
      website: 'https://linear.app/careers',
      atsProvider: 'ashby',
      atsUrl: 'https://jobs.ashbyhq.com/linear',
      atsSlug: 'linear',
    },
  },
]

async function moveCompanyRelations(sourceId: string, targetId: string) {
  await prisma.job.updateMany({
    where: { companyId: sourceId },
    data: { companyId: targetId },
  })

  await prisma.companySource.updateMany({
    where: { companyId: sourceId },
    data: { companyId: targetId },
  })
}

async function recalculateJobCount(companyId: string) {
  const activeJobs = await prisma.job.count({
    where: { companyId, isExpired: false },
  })

  await prisma.company.update({
    where: { id: companyId },
    data: { jobCount: activeJobs },
  })
}

async function applyDirectUpdates() {
  for (const update of DIRECT_UPDATES) {
    const company = await prisma.company.findUnique({
      where: { slug: update.slug },
    })

    if (!company) {
      __slog(`- Skip update: ${update.slug} not found`)
      continue
    }

    await prisma.company.update({
      where: { id: company.id },
      data: update.data,
    })

    __slog(`✓ Updated ${update.slug}`)
  }
}

async function applyMerges() {
  for (const merge of MERGES) {
    const [source, target] = await Promise.all([
      prisma.company.findUnique({ where: { slug: merge.sourceSlug } }),
      prisma.company.findUnique({ where: { slug: merge.targetSlug } }),
    ])

    if (!source || !target) {
      __slog(`- Skip merge: ${merge.sourceSlug} -> ${merge.targetSlug}`)
      continue
    }

    await moveCompanyRelations(source.id, target.id)

    if (merge.targetData) {
      await prisma.company.update({
        where: { id: target.id },
        data: merge.targetData,
      })
    }

    await prisma.company.delete({
      where: { id: source.id },
    })

    await recalculateJobCount(target.id)
    __slog(`✓ Merged ${merge.sourceSlug} -> ${merge.targetSlug}`)
  }
}

async function main() {
  __slog('=== Reconcile Top Companies ===')
  await applyDirectUpdates()
  await applyMerges()
}

main()
  .catch((error) => {
    __serr(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
