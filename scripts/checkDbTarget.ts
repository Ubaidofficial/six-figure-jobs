import { createHash } from 'node:crypto'
import { appendFile } from 'node:fs/promises'
import 'dotenv/config'

type TargetSummary = {
  source: 'DATABASE_URL' | 'POSTGRES_PRISMA_URL'
  fingerprint: string
  driver: string | null
  host: string | null
  port: string | null
  database: string | null
  schema: string | null
}

function redact(value: string | null): string {
  if (!value) return 'none'
  if (value.length <= 4) return `${value[0] ?? ''}***`
  return `${value.slice(0, 2)}***${value.slice(-2)}`
}

function defaultPortForProtocol(protocol: string | null): string | null {
  if (protocol === 'postgresql' || protocol === 'postgres') return '5432'
  return null
}

function normalizeExpectedFingerprint(raw: string | undefined): string | null {
  const normalized = (raw ?? '')
    .trim()
    .toLowerCase()
    .replace(/^sha256:/, '')

  return normalized || null
}

function parseTarget(source: TargetSummary['source']): TargetSummary | null {
  const raw = process.env[source]?.trim()
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
  }
}

function targetHint(target: TargetSummary): string {
  return `${target.driver ?? 'unknown'}://${redact(target.host)}:${target.port ?? 'none'}/${redact(
    target.database,
  )}?schema=${redact(target.schema)}`
}

async function appendStepSummary(lines: string[]) {
  const summaryPath = process.env.GITHUB_STEP_SUMMARY
  if (!summaryPath) return
  await appendFile(summaryPath, `${lines.join('\n')}\n`)
}

async function main() {
  const statusNotes: string[] = []
  const failureMessages: string[] = []
  const parseErrors: string[] = []

  const targets = (['DATABASE_URL', 'POSTGRES_PRISMA_URL'] as const)
    .map((source) => {
      try {
        return parseTarget(source)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        parseErrors.push(`${source} parse error: ${message}`)
        return null
      }
    })
    .filter((target): target is TargetSummary => target != null)

  if (parseErrors.length > 0) {
    failureMessages.push(...parseErrors)
  }

  if (targets.length === 0) {
    failureMessages.push('No database URL env found. Expected DATABASE_URL or POSTGRES_PRISMA_URL.')
  }

  const uniqueFingerprints = Array.from(new Set(targets.map((target) => target.fingerprint)))
  const activeFingerprint = uniqueFingerprints.length === 1 ? uniqueFingerprints[0] : null

  if (uniqueFingerprints.length > 1) {
    failureMessages.push(
      `DATABASE_URL and POSTGRES_PRISMA_URL resolve to different targets: ${uniqueFingerprints.join(', ')}`,
    )
  }

  const expectedFingerprint = normalizeExpectedFingerprint(process.env.EXPECTED_DB_TARGET_FINGERPRINT)
  if (expectedFingerprint) {
    if (!activeFingerprint) {
      failureMessages.push(
        'Expected database fingerprint is configured, but the active environment resolved to multiple targets.',
      )
    } else if (activeFingerprint !== expectedFingerprint) {
      failureMessages.push(
        `Database target fingerprint mismatch: expected ${expectedFingerprint}, got ${activeFingerprint}`,
      )
    }
  } else {
    statusNotes.push(
      'No EXPECTED_DB_TARGET_FINGERPRINT configured; fingerprint is reported but parity with production is not enforced yet.',
    )
  }

  const status = failureMessages.length > 0 ? 'fail' : statusNotes.length > 0 ? 'warn' : 'pass'

  console.log('=== Database Target Guard ===')
  console.log(`status=${status}`)
  console.log(`expectedFingerprint=${expectedFingerprint ?? 'not-configured'}`)
  console.log(`activeFingerprint=${activeFingerprint ?? 'multiple-or-missing'}`)
  console.log('targets:')
  for (const target of targets) {
    console.log(`- ${target.source}: fingerprint=${target.fingerprint} target=${targetHint(target)}`)
  }
  for (const note of statusNotes) {
    console.log(`note=${note}`)
  }

  await appendStepSummary([
    '## Database Target Guard',
    `- Status: ${status}`,
    `- Expected fingerprint: ${expectedFingerprint ?? 'not configured'}`,
    `- Active fingerprint: ${activeFingerprint ?? 'multiple or missing'}`,
    '',
    '### Detected Targets',
    ...(targets.length > 0
      ? targets.map(
          (target) =>
            `- ${target.source}: fingerprint=${target.fingerprint} target=${targetHint(target)}`,
        )
      : ['- none']),
    ...(statusNotes.length > 0 ? ['', '### Notes', ...statusNotes.map((note) => `- ${note}`)] : []),
    ...(failureMessages.length > 0
      ? ['', '### Failure Reasons', ...failureMessages.map((message) => `- ${message}`)]
      : []),
    '',
  ])

  if (failureMessages.length > 0) {
    throw new Error(`Database target guard failed: ${failureMessages.join(' | ')}`)
  }
}

main().catch((error) => {
  console.error('[checkDbTarget] error:', error)
  process.exit(1)
})
