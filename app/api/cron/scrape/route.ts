import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  return !!secret && auth === `Bearer ${secret}`
}

function runScrapeAndEnrich() {
  // Run scraping first
  const scrapeProcess = spawn(
    'npx',
    ['tsx', 'scripts/dailyScrapeV2.ts', '--mode=all', '--concurrency=5'],
    { env: process.env, stdio: 'inherit' }
  )

  // When scraping completes, run enrichment
  scrapeProcess.on('close', (code) => {
    if (code === 0) {
      console.log('✅ Scraping complete, starting apply URL enrichment...')
      spawn(
        'npx',
        ['tsx', 'scripts/enrich-apply-urls.ts'],
        { env: process.env, stdio: 'inherit' }
      )
    } else {
      console.error(`❌ Scraping failed with code ${code}, skipping enrichment`)
    }
  })
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  runScrapeAndEnrich()

  return NextResponse.json({ 
    success: true, 
    message: 'Started dailyScrapeV2 + apply URL enrichment' 
  })
}

export async function GET(req: Request) {
  return POST(req)
}
