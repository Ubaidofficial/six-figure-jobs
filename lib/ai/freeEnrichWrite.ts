// lib/ai/freeEnrichWrite.ts
//
// The pure parts of the free enrichment writer (scripts/enrich-jobs-free.ts): how many jobs a day may be enriched, which jobs
// share one description (one model call serves every copy), how a model's bullets are cleaned, and the exact database update.
// No network, no database: so each rule is tested.
import { createHash } from 'node:crypto'

import type { AiEnrichOutput } from './aiEnrichPrompt'

/** Stored in Job.aiVersion so a day's free enrichments can be counted and told from the paid path's. */
export const FREE_AI_VERSION = 'free-v1'
/** Jobs enriched per UTC day across every run: well inside the free allowances (see docs/FREE_ENRICHMENT_PLAN.md). */
export const DEFAULT_DAILY_MAX = 80
/** Jobs per run. */
export const DEFAULT_RUN_LIMIT = 40
export const MAX_RUN_LIMIT = 100

/** How many more jobs this run may enrich: the run's limit, never past the day's maximum minus what earlier runs did today. */
export function remainingToday(dailyMax: number, doneToday: number, runLimit: number): number {
  return Math.max(0, Math.min(runLimit, dailyMax - doneToday))
}

export function parseLimit(raw: string | undefined, fallback: number, max: number): number {
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, max) : fallback
}

/** The start of the current UTC day, which is when the daily count resets. */
export function startOfUtcDay(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

/** Two postings with the same text (a repost for another city) have the same key. */
export function descriptionKey(text: string): string {
  const folded = text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 6000)
  return createHash('sha256').update(folded).digest('hex')
}

/** Jobs grouped by their description, in input order: one model call can serve a whole group. */
export function groupByDescription<T extends { id: string }>(jobs: readonly T[], textOf: (job: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>()
  for (const job of jobs) {
    const text = textOf(job)
    if (!text) continue
    const key = descriptionKey(text)
    groups.set(key, [...(groups.get(key) ?? []), job])
  }
  return groups
}

const PREFERENCE = /\b(?:preferred|preferably|nice[- ]to[- ]have|a plus|bonus|ideally|desirable)\b/i
const MAX_BULLET_CHARS = 260

function cleanBullet(raw: string): string {
  return raw.replace(/^[\s•\-*–·]+/, '').replace(/\s+/g, ' ').trim()
}

/**
 * The model's bullets made safe to publish. A requirement the posting calls preferred stays visible but is labelled
 * "Preferred:", so a nice-to-have never reads as a must-have (seen in the first free run: "At least 8 years ... preferred"
 * listed under Requirements). Leading bullet glyphs are dropped (the page draws its own) and overlong bullets are removed.
 */
export function normalizeEnrichment(out: AiEnrichOutput): AiEnrichOutput {
  const tidy = (items: readonly string[] | undefined) =>
    (items ?? []).map(cleanBullet).filter((b) => b.length >= 8 && b.length <= MAX_BULLET_CHARS)
  const requirements = tidy(out.requirements).map((b) => (PREFERENCE.test(b) && !/^preferred\b/i.test(b) ? `Preferred: ${b}` : b))
  return {
    ...out,
    oneLiner: cleanBullet(out.oneLiner),
    snippet: cleanBullet(out.snippet),
    bullets: tidy(out.bullets),
    description: tidy(out.description),
    requirements,
    benefits: tidy(out.benefits),
    techStack: tidy(out.techStack),
  }
}

/**
 * The exact update for one job, in the shape the job page already reads (aiOneLiner, aiSnippet, aiSummaryJson with
 * bullets/description/requirements/benefits). The tech stack is written only to a job that has none, so a value from the
 * source or from the deterministic extractor is never replaced. The original description is not touched: the page keeps
 * showing it in full below the summary.
 */
export function buildJobUpdate(
  out: AiEnrichOutput,
  existing: { techStack: string | null },
  model: string,
  now: Date,
) {
  return {
    aiOneLiner: out.oneLiner.slice(0, 180),
    aiSnippet: out.snippet,
    aiSummaryJson: {
      bullets: out.bullets ?? [],
      description: out.description,
      requirements: out.requirements,
      benefits: out.benefits,
    },
    ...(!existing.techStack && out.techStack?.length ? { techStack: JSON.stringify(out.techStack) } : {}),
    aiModel: model,
    aiVersion: FREE_AI_VERSION,
    aiEnrichedAt: now,
    lastAiEnrichedAt: now,
  }
}
