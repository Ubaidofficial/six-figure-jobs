import crypto from 'node:crypto'

export type ScrapeStatus = {
  id: string
  status: 'running' | 'completed' | 'failed'
  startedAt: Date
  completedAt?: Date
  stats: {
    jobsAdded: number
    failures: number
    failedSources: string[]
  }
  error?: string
}

const statuses = new Map<string, ScrapeStatus>()

export function createScrapeJob(): string {
  const id = crypto.randomUUID()
  statuses.set(id, {
    id,
    status: 'running',
    startedAt: new Date(),
    stats: { jobsAdded: 0, failures: 0, failedSources: [] },
  })
  return id
}

export function updateScrapeStatus(id: string, update: Partial<ScrapeStatus>) {
  const current = statuses.get(id)
  if (!current) return
  statuses.set(id, { ...current, ...update })
}

export function getScrapeStatus(id: string) {
  return statuses.get(id)
}

export function completeScrapeJob(id: string, stats: ScrapeStatus['stats']) {
  updateScrapeStatus(id, {
    status: 'completed',
    completedAt: new Date(),
    stats,
  })
}

export function failScrapeJob(id: string, error: string) {
  updateScrapeStatus(id, {
    status: 'failed',
    completedAt: new Date(),
    error,
  })
}
