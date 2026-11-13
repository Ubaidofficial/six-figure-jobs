// lib/ai/freeLlm.ts
//
// Free-only LLM calls for job enrichment: OpenRouter's ":free" models and Cloudflare Workers AI's daily free allowance.
// The owner's rule is "free only, never credits", so this refuses to run anything that could cost money:
//   - OpenRouter: only model ids ending in ":free" (anything else could be billed to purchased credits);
//     a 402 "payment required" answer stops the run at once.
//   - Cloudflare: a 429 or "daily free allocation used up" answer ends the day; nothing here upgrades or pays.
//   - A per-day request cap well under each provider's free limit (counted by the caller, see DailyCap).
// Written from the providers' public docs without a live key, so the exact response shapes below are the first thing to
// check on a real call. Not wired into any workflow yet.

export type FreeProvider = 'openrouter' | 'cloudflare'
export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string }
export type FreeLlmResult = { text: string; provider: FreeProvider; model: string }

/** The run would (or might) cost money; stop everything. */
export class FreeOnlyViolation extends Error {}
/** The model answered 200 but with no text (a reasoning model can spend its whole budget thinking); try another model. */
export class EmptyAnswer extends Error {}
/** The provider's free allowance for the day is used up; stop this provider until tomorrow. */
export class QuotaExhausted extends Error {
  constructor(
    readonly provider: FreeProvider,
    message: string,
  ) {
    super(message)
  }
}

export function isFreeOpenRouterModel(model: string): boolean {
  return /^[\w.-]+\/[\w.:-]+:free$/.test(model)
}

export type OpenRouterModelInfo = { id: string; pricing?: { prompt?: string; completion?: string }; architecture?: { modality?: string } }

/** Under 10 billion parameters ("lfm-3-1.7b"): too weak to rewrite a posting without inventing things. */
const TINY_MODEL = /(^|[-/])\d(\.\d)?b[-:]/

/** Models tried first when they are on the free list, best instruction-followers first (checked against the list on 2026-11-13). */
const PREFERRED_FREE_MODELS = ['google/gemma-4-31b-it:free', 'google/gemma-4-26b-a4b-it:free', 'nvidia/nemotron-3-ultra-550b-a55b:free']

/**
 * Free models come and go (meta-llama/llama-3.3-70b-instruct:free was dropped), so the run asks OpenRouter's public model
 * list (GET /api/v1/models, no key) what is free today. Free means the id ends in ":free" AND both prices are exactly 0.
 * Returns every such text model, best first (preferred ones, then the rest by id), so a caller can move to the next one
 * when a free model is rate-limited. chatOpenRouter still re-checks the ":free" suffix.
 */
export function rankFreeOpenRouterModels(models: readonly OpenRouterModelInfo[]): string[] {
  const price = (v: string | undefined) => (v === undefined ? NaN : Number(v))
  const ids = models
    .filter(
      (m) =>
        isFreeOpenRouterModel(m.id) &&
        price(m.pricing?.prompt) === 0 &&
        price(m.pricing?.completion) === 0 &&
        (m.architecture?.modality ?? '').toLowerCase().split('->')[1]?.trim() === 'text' &&
        !/code|preview/.test(m.id) &&
        !TINY_MODEL.test(m.id),
    )
    .map((m) => m.id)
  const preferred = PREFERRED_FREE_MODELS.filter((id) => ids.includes(id))
  return [...preferred, ...ids.filter((id) => !preferred.includes(id)).sort()]
}

/** Cloudflare Workers AI model ids look like "@cf/meta/llama-3.1-8b-instruct"; their free allowance is a daily neuron count. */
export function isCloudflareModel(model: string): boolean {
  return /^@cf\/[\w.-]+\/[\w.-]+$/.test(model)
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; signal?: AbortSignal }) => Promise<{
  ok: boolean
  status: number
  text(): Promise<string>
}>

async function post(fetchImpl: FetchLike, url: string, headers: Record<string, string>, body: unknown, timeoutMs: number) {
  const res = await fetchImpl(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  })
  return { status: res.status, ok: res.ok, raw: await res.text() }
}

export async function chatOpenRouter(opts: {
  apiKey: string
  model: string
  messages: ChatMessage[]
  maxTokens?: number
  timeoutMs?: number
  fetchImpl?: FetchLike
}): Promise<FreeLlmResult> {
  if (!isFreeOpenRouterModel(opts.model)) {
    throw new FreeOnlyViolation(`Refusing OpenRouter model "${opts.model}": only ":free" models are allowed (anything else can use credits).`)
  }
  const { status, ok, raw } = await post(
    opts.fetchImpl ?? (fetch as unknown as FetchLike),
    'https://openrouter.ai/api/v1/chat/completions',
    { Authorization: `Bearer ${opts.apiKey}`, 'X-Title': '6figjobs enrichment' },
    { model: opts.model, messages: opts.messages, temperature: 0.1, ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}) },
    opts.timeoutMs ?? 60_000,
  )
  if (status === 402) throw new FreeOnlyViolation('OpenRouter answered 402 (payment required): stopping so no credits are used.')
  if (status === 429) throw new QuotaExhausted('openrouter', `OpenRouter 429 for ${opts.model}: ${raw.slice(0, 300)}`)
  if (!ok) throw new Error(`OpenRouter ${status}: ${raw.slice(0, 200)}`)
  const text = JSON.parse(raw)?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) throw new EmptyAnswer(`OpenRouter returned no text for ${opts.model}`)
  return { text, provider: 'openrouter', model: opts.model }
}

export async function chatCloudflare(opts: {
  accountId: string
  apiToken: string
  model: string
  messages: ChatMessage[]
  maxTokens?: number
  timeoutMs?: number
  fetchImpl?: FetchLike
}): Promise<FreeLlmResult> {
  if (!isCloudflareModel(opts.model)) {
    throw new FreeOnlyViolation(`Refusing Cloudflare model "${opts.model}": expected a Workers AI id such as "@cf/meta/llama-3.1-8b-instruct".`)
  }
  const { status, ok, raw } = await post(
    opts.fetchImpl ?? (fetch as unknown as FetchLike),
    `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(opts.accountId)}/ai/run/${opts.model}`,
    { Authorization: `Bearer ${opts.apiToken}` },
    { messages: opts.messages, ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}) },
    opts.timeoutMs ?? 60_000,
  )
  // Only a refusal can mean the allowance is used up: a good answer may report the neurons it used. Say what Cloudflare
  // answered, so a wrong account id or token is not mistaken for the day's quota.
  if (!ok) {
    if (status === 429 || /daily free allocation|neurons/i.test(raw)) {
      throw new QuotaExhausted('cloudflare', `Cloudflare Workers AI free daily allowance used up (${status}: ${raw.slice(0, 200)})`)
    }
    throw new Error(`Cloudflare ${status}: ${raw.slice(0, 200)}`)
  }
  const text = JSON.parse(raw)?.result?.response
  if (typeof text !== 'string' || !text.trim()) throw new Error('Cloudflare returned no text')
  return { text, provider: 'cloudflare', model: opts.model }
}

/** The first JSON object in a model's answer (it may wrap it in a code fence or add a sentence), or null. */
export function parseJsonObject(text: string): Record<string, unknown> | null {
  const unfenced = String(text ?? '')
    .replace(/```(?:json)?/gi, '')
    .trim()
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const value = JSON.parse(unfenced.slice(start, end + 1))
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/**
 * A per-day request cap. `alreadyUsedToday` comes from the database (jobs enriched today by this provider) so separate
 * workflow runs share one budget. Set the cap well under the provider's free limit; failed calls count too.
 */
export class DailyCap {
  private used: number
  constructor(
    readonly limit: number,
    alreadyUsedToday = 0,
  ) {
    this.used = Math.max(0, alreadyUsedToday)
  }
  /** True and counts one when a request is still allowed today. */
  take(): boolean {
    if (this.used >= this.limit) return false
    this.used += 1
    return true
  }
  get remaining(): number {
    return Math.max(0, this.limit - this.used)
  }
}
