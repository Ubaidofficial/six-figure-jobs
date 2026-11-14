// lib/ai/freeEnrichRunner.ts
//
// Asks a FREE model for one completion, shared by the dry run (scripts/enrich-jobs-dry-run.ts) and the writer
// (scripts/enrich-jobs-free.ts) so both behave the same. Free only: lib/ai/freeLlm.ts refuses anything that could cost money.
//
//  - Cloudflare Workers AI's free daily allowance answered 3 of 3 in about 10 s in the first real run (2026-11-14);
//  - OpenRouter's ":free" models answered 1 of 5 in 6 minutes (429s, empty answers), so they are the fallback.
//
// A rate-limited (429) OpenRouter model is retried twice after a pause, then the next free model is tried; one that answers
// with no text moves on at once. When every model has refused the error reaches the caller, which stops the run.
import { EmptyAnswer, QuotaExhausted, chatCloudflare, chatOpenRouter, rankFreeOpenRouterModels, type FreeLlmResult, type OpenRouterModelInfo } from './freeLlm'

export type FreeProvider = 'openrouter' | 'cloudflare' | 'none'
type Env = Record<string, string | undefined>

/** The provider to use: the one asked for if its key is set; "auto" prefers Cloudflare (reliable), then OpenRouter. */
export function pickFreeProvider(env: Env, requested: string | undefined): FreeProvider {
  const hasOpenRouter = Boolean(env.OPENROUTER_API_KEY?.trim())
  const hasCloudflare = Boolean(env.CLOUDFLARE_ACCOUNT_ID?.trim() && env.CLOUDFLARE_API_TOKEN?.trim())
  if (requested === 'none') return 'none'
  if (requested === 'openrouter') return hasOpenRouter ? 'openrouter' : 'none'
  if (requested === 'cloudflare') return hasCloudflare ? 'cloudflare' : 'none'
  return hasCloudflare ? 'cloudflare' : hasOpenRouter ? 'openrouter' : 'none'
}

const MAX_OPENROUTER_MODELS = 4
export const CLOUDFLARE_DEFAULT_MODEL = '@cf/meta/llama-3.1-8b-instruct'

async function resolveOpenRouterModels(env: Env): Promise<string[]> {
  const set = env.OPENROUTER_MODEL?.trim()
  if (set) return [set]
  const res = await fetch('https://openrouter.ai/api/v1/models', { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`OpenRouter model list answered ${res.status}`)
  const ranked = rankFreeOpenRouterModels(((await res.json()) as { data?: OpenRouterModelInfo[] }).data ?? [])
  if (!ranked.length) throw new Error('OpenRouter lists no free text model today; set OPENROUTER_MODEL or use provider=cloudflare')
  return ranked.slice(0, MAX_OPENROUTER_MODELS)
}

export type FreeAsker = (prompt: string) => Promise<FreeLlmResult>

export async function createFreeAsker(opts: {
  provider: Exclude<FreeProvider, 'none'>
  env: Env
  log?: (line: string) => void
  sleep?: (ms: number) => Promise<void>
  maxTokens?: number
}): Promise<FreeAsker> {
  const { provider, env } = opts
  const log = opts.log ?? (() => {})
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)))
  const maxTokens = opts.maxTokens ?? 1500

  if (provider === 'cloudflare') {
    const model = env.CLOUDFLARE_MODEL?.trim() || CLOUDFLARE_DEFAULT_MODEL
    return (prompt) => chatCloudflare({ accountId: env.CLOUDFLARE_ACCOUNT_ID!, apiToken: env.CLOUDFLARE_API_TOKEN!, model, messages: [{ role: 'user', content: prompt }], maxTokens })
  }

  const models = await resolveOpenRouterModels(env)
  log(`OpenRouter free models to try, in order: ${models.join(', ')}`)
  let index = 0
  return async (prompt) => {
    let waits = 0
    for (;;) {
      try {
        return await chatOpenRouter({ apiKey: env.OPENROUTER_API_KEY!, model: models[index], messages: [{ role: 'user', content: prompt }], maxTokens })
      } catch (e) {
        if (e instanceof QuotaExhausted && waits < 2) {
          waits++
          log(`Rate-limited, waiting 20s then retrying ${models[index]} (${waits} of 2).`)
          await sleep(20_000)
          continue
        }
        if (!(e instanceof QuotaExhausted || e instanceof EmptyAnswer) || index + 1 >= models.length) throw e
        log(`Moving to the next free model: ${e.message.slice(0, 200)}`)
        index++
        waits = 0
      }
    }
  }
}
