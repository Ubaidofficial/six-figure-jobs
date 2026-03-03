// lib/scrapers/scraperStats.ts

export type ScraperStats = {
  created: number
  updated: number
  skipped: number
  error?: string
}

export function emptyStats(): ScraperStats {
  return { created: 0, updated: 0, skipped: 0 }
}

export function errorStats(error: unknown): ScraperStats {
  return {
    created: 0,
    updated: 0,
    skipped: 0,
    error: error instanceof Error ? error.message : String(error),
  }
}

export function addBoardIngestResult(
  stats: ScraperStats,
  result: 'new' | 'updated' | 'skipped',
) {
  if (result === 'new') stats.created++
  else if (result === 'updated') stats.updated++
  else stats.skipped++
}

export function addIngestStatus(
  stats: ScraperStats,
  status: 'created' | 'updated' | 'upgraded' | 'skipped' | 'error',
) {
  if (status === 'created') stats.created++
  else if (status === 'updated' || status === 'upgraded') stats.updated++
  else stats.skipped++
}

