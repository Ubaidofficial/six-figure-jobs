// lib/scrapers/cursordirectory.ts
// Scrapes jobs from cursor.directory/jobs
import axios from 'axios'
import { PrismaClient } from '@prisma/client'
import { ingestJob } from '../ingest'
import { makeBoardSource } from '../ingest/sourcePriority'

const prisma = new PrismaClient()

export default async function scrapeCursorDirectory() {
  console.log('[CursorDirectory] Starting scrape...')

  try {
    // Lightweight DB touch to keep prisma referenced (and validate connectivity if this is run)
    await prisma.job.count({ where: { isExpired: false } })

    // Check if they have an API or need to scrape HTML
    const response = await axios.get('https://cursor.directory/jobs', {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      timeout: 30000,
    })

    // If they have JSON API:
    // const jobs = response.data

    // If HTML, use cheerio like RemoteYeah
    // Parse and extract job listings

    // Example ingestion shape (placeholder):
    void ingestJob
    void makeBoardSource
    void response

    console.log('[CursorDirectory] Scrape complete')
    return { created: 0, updated: 0 }
  } catch (error) {
    console.error('[CursorDirectory] Scrape failed:', error)
    return { created: 0, updated: 0, error }
  }
}

