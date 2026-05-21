import { spawnSync } from 'node:child_process'

type Status = 'pass' | 'warn' | 'fail'

type Step = {
  id: string
  label: string
  command: string
  args: string[]
  env?: Record<string, string>
  classify?: (exitCode: number, output: string) => { status: Status; detail: string }
}

type StepResult = {
  id: string
  label: string
  status: Status
  detail: string
}

const STRICT = process.argv.includes('--strict') || process.env.SEO_AUDIT_STRICT === '1'

function isTransientDbUnavailable(output: string): boolean {
  return (
    output.includes("Can't reach database server") ||
    output.includes('Connection terminated unexpectedly') ||
    output.includes('Timed out fetching a new connection from the connection pool')
  )
}

const steps: Step[] = [
  {
    id: 'A1',
    label: 'TypeScript',
    command: 'npm',
    args: ['run', 'typecheck'],
  },
  {
    id: 'A2',
    label: 'Test suite',
    command: 'npm',
    args: ['test', '--', '--runInBand'],
  },
  {
    id: 'A3',
    label: 'Best-practices audit',
    command: 'npm',
    args: ['run', 'seo:audit:best-practices'],
  },
  {
    id: 'A4',
    label: 'SEO validator',
    command: 'node',
    args: ['--import', 'tsx', 'scripts/seo-validate.ts'],
  },
  ...(STRICT
    ? ([
        {
          id: 'A5',
          label: 'SEO validator (strict)',
          command: 'node',
          args: ['--import', 'tsx', 'scripts/seo-validate.ts'],
          env: {
            SEO_STRICT: '1',
            SEO_SAMPLE_PER_SITEMAP: '1000',
            SEO_CONCURRENCY: '4',
            SEO_TIMEOUT_MS: '60000',
          },
        },
      ] satisfies Step[])
    : []),
  {
    id: STRICT ? 'A6' : 'A5',
    label: 'SEO fix verification',
    command: 'node',
    args: ['--import', 'tsx', 'scripts/verify-seo-fixes.ts'],
    classify: (exitCode, output) => {
      const validThroughColumnMissing = output.includes('The column `Job.validThrough` does not exist')
      if (exitCode === 0) {
        return { status: 'pass', detail: 'verification checks passed' }
      }
      if (validThroughColumnMissing) {
        return {
          status: 'warn',
          detail:
            'local database schema is behind prisma/schema.prisma; apply the validThrough migration before trusting DB-backed audit checks',
        }
      }
      if (isTransientDbUnavailable(output)) {
        return {
          status: 'warn',
          detail:
            'DB-backed verification hit a transient Railway proxy outage; rerun when the database connection is stable before treating this as an app issue',
        }
      }
      return { status: 'fail', detail: 'verification script failed' }
    },
  },
]

function statusLabel(status: Status): string {
  switch (status) {
    case 'pass':
      return 'PASS'
    case 'warn':
      return 'WARN'
    case 'fail':
      return 'FAIL'
  }
}

function runStep(step: Step): StepResult {
  const res = spawnSync(step.command, step.args, {
    cwd: process.cwd(),
    env: { ...process.env, ...step.env },
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  })

  const output = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim()
  if (step.classify) {
    const classified = step.classify(res.status ?? 1, output)
    return {
      id: step.id,
      label: step.label,
      status: classified.status,
      detail: classified.detail,
    }
  }

  const lastNonEmptyLine =
    output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-1)[0] ?? 'no output'

  return {
    id: step.id,
    label: step.label,
    status: (res.status ?? 1) === 0 ? 'pass' : 'fail',
    detail:
      (res.status ?? 1) === 0
        ? 'ok'
        : `command failed (status=${res.status ?? 'null'} signal=${res.signal ?? 'none'}): ${lastNonEmptyLine}`,
  }
}

function printSummary(results: StepResult[]) {
  const passCount = results.filter((r) => r.status === 'pass').length
  const warnCount = results.filter((r) => r.status === 'warn').length
  const failCount = results.filter((r) => r.status === 'fail').length

  console.log('===================================================')
  console.log('PROJECT HEALTH AUDIT')
  console.log(`Mode: ${STRICT ? 'strict' : 'standard'}`)
  console.log('===================================================')
  for (const result of results) {
    console.log(`${result.id} ${statusLabel(result.status)}  ${result.label} — ${result.detail}`)
  }
  console.log('---------------------------------------------------')
  console.log(`Pass: ${passCount}`)
  console.log(`Warn: ${warnCount}`)
  console.log(`Fail: ${failCount}`)
  console.log('===================================================')
}

const results = steps.map(runStep)
printSummary(results)

if (results.some((result) => result.status === 'fail')) {
  process.exitCode = 1
}
