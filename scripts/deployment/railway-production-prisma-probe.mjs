/* global URL, console, process */
import { createHash } from 'node:crypto'
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

function redact(value) {
  if (!value) return 'none'
  if (value.length <= 4) return `${value[0] ?? ''}***`
  return `${value.slice(0, 2)}***${value.slice(-2)}`
}

function defaultPortForProtocol(protocol) {
  if (protocol === 'postgresql' || protocol === 'postgres') return '5432'
  return null
}

function summarizeDbTarget(source, raw) {
  if (!raw) return null

  const url = new URL(raw)
  const driver = url.protocol.replace(/:$/, '') || null
  const host = url.hostname || null
  const port = url.port || defaultPortForProtocol(driver)
  const database = url.pathname.replace(/^\/+/, '') || null
  const schema = url.searchParams.get('schema') || 'public'

  const normalizedTarget = JSON.stringify({
    driver,
    host: host?.toLowerCase() ?? null,
    port,
    database: database?.toLowerCase() ?? null,
    schema: schema.toLowerCase(),
  })

  const fingerprint = createHash('sha256').update(normalizedTarget).digest('hex').slice(0, 16)

  return {
    source,
    fingerprint,
    driver,
    host,
    port,
    database,
    schema,
    targetHint: `${driver ?? 'unknown'}://${redact(host)}:${port ?? 'none'}/${redact(database)}?schema=${redact(schema)}`,
  }
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
  const dbTargetErrors = []
  const dbTargets = ['DATABASE_URL', 'POSTGRES_PRISMA_URL']
    .map((source) => {
      try {
        return summarizeDbTarget(source, process.env[source])
      } catch (error) {
        dbTargetErrors.push({
          source,
          error: summarizeError(error),
        })
        return null
      }
    })
    .filter(Boolean)
  const uniqueFingerprints = Array.from(new Set(dbTargets.map((target) => target.fingerprint)))
  const activeFingerprint = uniqueFingerprints.length === 1 ? uniqueFingerprints[0] : null

  printJson('env', {
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasPostgresPrismaUrl: Boolean(process.env.POSTGRES_PRISMA_URL),
    prismaConnectionLimit: process.env.PRISMA_CONNECTION_LIMIT ?? null,
    prismaPoolTimeout: process.env.PRISMA_POOL_TIMEOUT ?? null,
    nodeEnv: process.env.NODE_ENV ?? null,
  })
  printJson(
    'dbTarget.detected',
    dbTargets.map((target) => ({
      source: target.source,
      fingerprint: target.fingerprint,
      targetHint: target.targetHint,
    })),
  )
  printJson('dbTarget.summary', {
    activeFingerprint,
    targetCount: dbTargets.length,
    consistent: uniqueFingerprints.length <= 1,
    githubVariable: activeFingerprint
      ? {
          name: 'PRODUCTION_DB_TARGET_FINGERPRINT',
          value: activeFingerprint,
        }
      : null,
  })

  if (dbTargetErrors.length > 0) {
    hasFailure = true
    printJson('dbTarget.parse_errors', dbTargetErrors)
  }

  if (dbTargets.length === 0) {
    hasFailure = true
    printJson('dbTarget.error', {
      message: 'No DATABASE_URL or POSTGRES_PRISMA_URL found in the production environment.',
    })
  } else if (uniqueFingerprints.length > 1) {
    hasFailure = true
    printJson('dbTarget.mismatch', {
      message: 'DATABASE_URL and POSTGRES_PRISMA_URL resolve to different database targets.',
      fingerprints: uniqueFingerprints,
    })
  }

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
