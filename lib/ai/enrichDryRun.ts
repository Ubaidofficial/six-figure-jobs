// lib/ai/enrichDryRun.ts
// Small pure helpers for scripts/enrich-jobs-dry-run.ts, kept here so they can be tested.

export function stripHtml(html: string | null | undefined): string {
  return String(html ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** A rough token count (about four characters a token for English); good enough to size a free quota. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export type DryRunEnv = Record<string, string | undefined>
export type ProviderChoice = 'openrouter' | 'cloudflare' | 'none'

/** The provider to use: the one asked for if its key is set, else the first with a key, else none (a prompt-only run). */
export function pickProvider(env: DryRunEnv, requested: string | undefined): ProviderChoice {
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY?.trim())
  const hasCloudflare = Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim())
  if (requested === 'none') return 'none'
  if (requested === 'openrouter') return hasOpenRouter ? 'openrouter' : 'none'
  if (requested === 'cloudflare') return hasCloudflare ? 'cloudflare' : 'none'
  return hasOpenRouter ? 'openrouter' : hasCloudflare ? 'cloudflare' : 'none'
}

/** The sample size: a whole number from 1 to 20, default 10 (a dry run must stay small). */
export function parseSampleSize(raw: string | undefined): number {
  const n = Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n >= 1 ? Math.min(n, 20) : 10
}
