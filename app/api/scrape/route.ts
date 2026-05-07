import { NextResponse } from 'next/server'
import { POST as runCronScrape } from '../cron/scrape/route'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

type ScrapeMode = 'all' | 'boards' | 'ats'

function normalizeMode(req: Request): ScrapeMode {
  const { searchParams } = new URL(req.url)
  const raw = (
    searchParams.get('mode') ??
    searchParams.get('target') ??
    'all'
  ).toLowerCase()

  return raw === 'boards' || raw === 'ats' ? raw : 'all'
}

function buildCronRequest(req: Request): Request {
  const cronUrl = new URL('/api/cron/scrape', req.url)
  cronUrl.searchParams.set('mode', normalizeMode(req))

  return new Request(cronUrl, {
    method: 'POST',
    headers: req.headers,
  })
}

async function delegateToCronScrape(req: Request): Promise<NextResponse> {
  const response = await runCronScrape(buildCronRequest(req))
  response.headers.set('X-Deprecated-Endpoint', '/api/scrape')
  response.headers.set('X-Use-Endpoint', '/api/cron/scrape')
  return response
}

export async function GET(req: Request) {
  return delegateToCronScrape(req)
}

export async function POST(req: Request) {
  return delegateToCronScrape(req)
}
