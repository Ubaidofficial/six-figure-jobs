import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'
import {
  addScrapeWarning,
  completeScrapeJob,
  createScrapeJob,
  failScrapeJob,
  updateScrapeStatus,
} from '../../../../lib/scrape-status'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const auth = req.headers.get('authorization')
  const secrets = [process.env.CRON_SECRET, process.env.CRON_SECRET_NEXT].filter(Boolean)
  if (!auth || secrets.length === 0) return false
  return secrets.some((s) => auth === `Bearer ${s}`)
}

type Mode = 'all' | 'boards' | 'ats'

function parseMode(req: Request): Mode {
  const { searchParams } = new URL(req.url)
  const raw = (searchParams.get('mode') ?? 'all').toLowerCase()
  return raw === 'boards' || raw === 'ats' ? (raw as Mode) : 'all'
}

function runScrapeAndEnrichPipeline(jobId: string, mode: Mode) {
  console.log('🚀 Starting full scrape and enrichment pipeline...')

  const stats = { jobsAdded: 0, failures: 0, failedSources: [] as string[] }

  const tailLines = (input: string, maxLines: number): string => {
    const lines = String(input || '')
      .split('\n')
      .map((l) => l.replace(/\r$/, ''))
    return lines.slice(-maxLines).join('\n').trim()
  }

  const redactSecrets = (input: string): string => {
    let out = String(input || '')
    out = out.replace(/Bearer\\s+[^\\s]+/gi, 'Bearer [REDACTED]')
    out = out.replace(/\\bsk-[A-Za-z0-9]{10,}\\b/g, 'sk-[REDACTED]')
    out = out.replace(
      /\\b(DEEPSEEK|OPENAI)_API_KEY\\b\\s*[:=]\\s*[^\\s]+/gi,
      (_m, k) => `${k}_API_KEY=[REDACTED]`,
    )
    return out
  }

  const spawnLogged = (cmd: string, args: string[], env: NodeJS.ProcessEnv) => {
    const child = spawn(cmd, args, { env, stdio: ['ignore', 'pipe', 'pipe'] })
    const MAX_BUFFER = 500_000
    let stdout = ''
    let stderr = ''

    child.stdout?.on('data', (chunk) => {
      stdout += chunk.toString()
      if (stdout.length > MAX_BUFFER) stdout = stdout.slice(-MAX_BUFFER)
      process.stdout.write(chunk)
    })
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString()
      if (stderr.length > MAX_BUFFER) stderr = stderr.slice(-MAX_BUFFER)
      process.stderr.write(chunk)
    })

    return { child, getStdout: () => stdout, getStderr: () => stderr }
  }

  // Step 1: Run scraping
  const scrape = spawnLogged(
    'npx',
    ['tsx', 'scripts/dailyScrapeV2.ts', `--mode=${mode}`, '--concurrency=5'],
    process.env,
  )

  scrape.child.on('error', (err) => {
    failScrapeJob(jobId, `scraping spawn error: ${err?.message || String(err)}`)
  })

  scrape.child.on('close', (scrapeCode) => {
    if (scrapeCode !== 0) {
      const stderr = scrape.getStderr().trim()
      failScrapeJob(
        jobId,
        `scraping failed with code ${scrapeCode}${stderr ? `: ${stderr.slice(-500)}` : ''}`,
      )
      return
    }

    const out = scrape.getStdout()
    const marker = '__SCRAPE_STATS__'
    const line = out
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.startsWith(marker))
      .slice(-1)[0]

    if (line) {
      const json = line.slice(marker.length).trim()
      try {
        const parsed = JSON.parse(json)
        stats.jobsAdded = Number(parsed?.jobsAdded ?? 0)
        stats.failures = Number(parsed?.failures ?? 0)
        stats.failedSources = Array.isArray(parsed?.failedSources) ? parsed.failedSources : []
        updateScrapeStatus(jobId, { stats })
      } catch {
        // ignore parsing errors; we'll still track completion state
      }
    }

    console.log('✅ Scraping complete, starting apply URL enrichment...')

    // Step 2: Apply URL enrichment
    const applyUrl = spawnLogged('npx', ['tsx', 'scripts/enrich-apply-urls.ts'], process.env)

    applyUrl.child.on('error', (err) => {
      failScrapeJob(jobId, `apply URL enrichment spawn error: ${err?.message || String(err)}`)
    })

    applyUrl.child.on('close', (applyCode) => {
      if (applyCode !== 0) {
        failScrapeJob(jobId, `apply URL enrichment failed with code ${applyCode}`)
        return
      }

      console.log('✅ Apply URL enrichment complete')
      console.log('🤖 Starting AI enrichment (batch)...')

      // Step 3: AI enrichment (batch)
      const aiEnrich = spawnLogged(
        'npx',
        ['tsx', 'scripts/aiEnrichJobs.ts'],
        {
          ...process.env,
          AI_ENRICH_MAX_JOBS_PER_RUN: process.env.AI_ENRICH_MAX_JOBS_PER_RUN || '200',
          AI_ENRICH_MAX_DAILY_JOBS: process.env.AI_ENRICH_MAX_DAILY_JOBS || '500',
          AI_ENRICH_MAX_DAILY_USD: process.env.AI_ENRICH_MAX_DAILY_USD || '0.33',
        },
      )

      let aiEnrichmentOk = true
      let aiFailureHandled = false
      let locationStarted = false

      const startLocation = () => {
        if (locationStarted) return
        locationStarted = true

        console.log('📍 Starting location parsing...')

        // Step 4: Location parsing
        const location = spawnLogged(
          'npx',
          ['tsx', 'scripts/repair-location-v2.10.ts'],
          {
            ...process.env,
            DRY_RUN: '0',
            TAKE: '10000',
          },
        )

        location.child.on('error', (err) => {
          failScrapeJob(jobId, `location parsing spawn error: ${err?.message || String(err)}`)
        })

        location.child.on('close', (locationCode) => {
          if (locationCode !== 0) {
            failScrapeJob(jobId, `location parsing failed with code ${locationCode}`)
            return
          }

          console.log('✅ Location parsing complete')
          console.log('🎉 Full pipeline complete!')
          console.log('   1. ✅ Scraping')
          console.log('   2. ✅ Apply URL enrichment')
          console.log(`   3. ${aiEnrichmentOk ? '✅' : '⚠️'} AI enrichment`)
          console.log('   4. ✅ Location parsing')

          completeScrapeJob(jobId, stats)
        })
      }

      const recordAiEnrichmentWarning = (reason: string) => {
        if (aiFailureHandled) return
        aiFailureHandled = true
        aiEnrichmentOk = false

        const stdoutTail = tailLines(aiEnrich.getStdout(), 40)
        const stderrTail = tailLines(aiEnrich.getStderr(), 40)

        const detail = [
          `AI enrichment failed (${reason}). Continuing to location parsing.`,
          stderrTail ? `--- stderr (tail) ---\n${stderrTail}` : null,
          stdoutTail ? `--- stdout (tail) ---\n${stdoutTail}` : null,
        ]
          .filter(Boolean)
          .join('\n')

        const sanitized = redactSecrets(detail).slice(-20_000)
        console.error('[pipeline] %s', sanitized)

        addScrapeWarning(jobId, `AI enrichment failed: ${reason}`)
        updateScrapeStatus(jobId, { aiEnrichmentError: sanitized })
      }

      // If the process fails to spawn, we may still see "close" after "error";
      // ensure we only record the warning once.
      aiEnrich.child.on('error', (err) => {
        recordAiEnrichmentWarning(`spawn error: ${err?.message || String(err)}`)
        startLocation()
      })

      aiEnrich.child.on('close', (aiCode) => {
        if (aiCode !== 0) {
          recordAiEnrichmentWarning(`exit code ${aiCode}`)
          startLocation()
          return
        }

        console.log('✅ AI enrichment complete')
        startLocation()
      })
    })
  })
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  const mode = parseMode(req)
  const jobId = createScrapeJob()

  runScrapeAndEnrichPipeline(jobId, mode)

  return NextResponse.json({
    success: true,
    jobId,
    statusUrl: `/api/scrape/status/${jobId}`,
    message: 'Started full pipeline: scraping → apply URLs → AI enrichment → location parsing',
  })
}

export async function GET(req: Request) {
  return POST(req)
}
