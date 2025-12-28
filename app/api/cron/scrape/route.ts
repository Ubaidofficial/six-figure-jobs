import { NextResponse } from 'next/server'
import { spawn } from 'node:child_process'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  const auth = req.headers.get('authorization')
  return !!secret && auth === `Bearer ${secret}`
}

function runScrapeAndEnrichPipeline() {
  console.log('🚀 Starting full scrape and enrichment pipeline...')
  
  // Step 1: Run scraping
  const scrapeProcess = spawn(
    'npx',
    ['tsx', 'scripts/dailyScrapeV2.ts', '--mode=all', '--concurrency=5'],
    { env: process.env, stdio: 'inherit' }
  )

  scrapeProcess.on('close', (scrapeCode) => {
    if (scrapeCode !== 0) {
      console.error(`❌ Scraping failed with code ${scrapeCode}, aborting pipeline`)
      return
    }

    console.log('✅ Scraping complete, starting apply URL enrichment...')

    // Step 2: Apply URL enrichment
    const applyUrlProcess = spawn(
      'npx',
      ['tsx', 'scripts/enrich-apply-urls.ts'],
      { env: process.env, stdio: 'inherit' }
    )

    applyUrlProcess.on('close', (applyCode) => {
      if (applyCode !== 0) {
        console.error(`⚠️  Apply URL enrichment failed with code ${applyCode}`)
      } else {
        console.log('✅ Apply URL enrichment complete')
      }

      console.log('🤖 Starting strategic AI enrichment...')

      // Step 3: Strategic AI enrichment
      const aiEnrichProcess = spawn(
        'npx',
        ['tsx', 'scripts/aiEnrichStrategic.ts'],
        { 
          env: {
            ...process.env,
            TOP_N: '30',           // Top 30 jobs per category
            MAX_TOTAL: '500'       // Max 500 jobs total per run
          },
          stdio: 'inherit'
        }
      )

      aiEnrichProcess.on('close', (aiCode) => {
        if (aiCode !== 0) {
          console.error(`⚠️  AI enrichment failed with code ${aiCode}`)
        } else {
          console.log('✅ AI enrichment complete')
        }
        
        console.log('📍 Starting location parsing...')

        // Step 4: Location parsing
        const locationProcess = spawn(
          'npx',
          ['tsx', 'scripts/repair-location-v2.10.ts'],
          { 
            env: {
              ...process.env,
              DRY_RUN: '0',          // Actually write to DB
              TAKE: '10000'          // Process up to 10k jobs per run
            },
            stdio: 'inherit'
          }
        )

        locationProcess.on('close', (locationCode) => {
          if (locationCode !== 0) {
            console.error(`⚠️  Location parsing failed with code ${locationCode}`)
          } else {
            console.log('✅ Location parsing complete')
          }
          
          console.log('🎉 Full pipeline complete!')
          console.log('   1. ✅ Scraping')
          console.log('   2. ✅ Apply URL enrichment')
          console.log('   3. ✅ Strategic AI enrichment')
          console.log('   4. ✅ Location parsing')
        })
      })
    })
  })
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  runScrapeAndEnrichPipeline()

  return NextResponse.json({
    success: true,
    message: 'Started full pipeline: scraping → apply URLs → AI enrichment → location parsing'
  })
}

export async function GET(req: Request) {
  return POST(req)
}
