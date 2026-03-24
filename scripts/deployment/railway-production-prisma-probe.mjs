import { PrismaClient } from '@prisma/client'

function summarizeError(error) {
  if (!error || typeof error !== 'object') {
    return {
      name: 'UnknownError',
      message: String(error),
      code: null,
    }
  }

  return {
    name: error.name ?? 'Error',
    message: error.message ?? String(error),
    code: error.code ?? null,
  }
}

function printSection(title) {
  console.log(`\n=== ${title} ===`)
}

function printJson(label, value) {
  console.log(`${label}: ${JSON.stringify(value, null, 2)}`)
}

const prisma = new PrismaClient({ log: ['error'] })

let hasFailure = false

async function runStep(label, fn) {
  try {
    const value = await fn()
    printJson(`${label}.ok`, value)
    return value
  } catch (error) {
    hasFailure = true
    printJson(`${label}.error`, summarizeError(error))
    return null
  }
}

async function main() {
  printSection('Environment')
  printJson('env', {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasPostgresPrismaUrl: Boolean(process.env.POSTGRES_PRISMA_URL),
    prismaConnectionLimit: process.env.PRISMA_CONNECTION_LIMIT ?? null,
    prismaPoolTimeout: process.env.PRISMA_POOL_TIMEOUT ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  })

  printSection('Migration Table')
  await runStep('migrations.recent', async () =>
    prisma.$queryRawUnsafe(`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      ORDER BY finished_at DESC NULLS LAST, migration_name DESC
      LIMIT 12
    `),
  )

  printSection('Schema Presence')
  await runStep('schema.tables', async () =>
    prisma.$queryRawUnsafe(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('Job', 'Company', 'CompanyATS', 'SalaryAggregate', 'RoleInference')
      ORDER BY table_name
    `),
  )

  await runStep('schema.job_columns', async () =>
    prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Job'
        AND column_name IN (
          'salaryConfidence',
          'salaryValidated',
          'salarySource',
          'salaryNormalizedAt',
          'needsReview',
          'workArrangementNormalized',
          'companyId'
        )
      ORDER BY column_name
    `),
  )

  await runStep('schema.company_columns', async () =>
    prisma.$queryRawUnsafe(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'Company'
        AND column_name IN (
          'sizeBucket',
          'industry',
          'atsProvider',
          'atsUrl',
          'lastJobCountSyncAt'
        )
      ORDER BY column_name
    `),
  )

  await runStep('schema.indexes', async () =>
    prisma.$queryRawUnsafe(`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename = 'Job'
        AND indexname IN (
          'Job_active_createdAt_idx',
          'Job_active_updatedAt_id_idx',
          'Job_role_salary_gate_idx',
          'Job_country_salary_gate_idx',
          'Job_city_salary_gate_idx',
          'Job_remote_salary_gate_idx',
          'Job_company_active_idx',
          'Job_aiEnrichedAt_idx'
        )
      ORDER BY indexname
    `),
  )

  printSection('Prisma Query Probe')
  await runStep('probe.job_count', async () =>
    prisma.job.count({
      where: {
        isExpired: false,
      },
    }),
  )

  await runStep('probe.listing_select', async () =>
    prisma.job.findFirst({
      where: {
        isExpired: false,
      },
      select: {
        id: true,
        title: true,
        salaryConfidence: true,
        salaryValidated: true,
        needsReview: true,
        workArrangementNormalized: true,
        companyRef: {
          select: {
            id: true,
            slug: true,
            sizeBucket: true,
            industry: true,
          },
        },
        roleInference: {
          select: {
            id: true,
            roleSlug: true,
            seniority: true,
          },
        },
      },
    }),
  )

  printSection('Classification')
  if (hasFailure) {
    console.log(
      'classification: production database path still failing; inspect error codes/messages above to separate schema drift from connectivity or pool pressure',
    )
    process.exitCode = 1
  } else {
    console.log('classification: schema objects and representative Prisma listing query succeeded')
  }
}

main()
  .catch((error) => {
    printJson('probe.fatal', summarizeError(error))
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
