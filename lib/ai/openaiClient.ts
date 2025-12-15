// lib/ai/openaiClient.ts
/**
 * OpenAI-compatible chat client wrapper.
 *
 * v2.9: We route to DeepSeek when AI_PROVIDER=deepseek.
 * DeepSeek is OpenAI-API compatible via https://api.deepseek.com/v1 :contentReference[oaicite:2]{index=2}
 *
 * Env:
 *  - AI_PROVIDER=deepseek | openai (default openai)
 *  - DEEPSEEK_API_KEY=...
 *  - OPENAI_API_KEY=... (optional / legacy)
 *  - AI_MODEL=deepseek-chat (recommended) or deepseek-reasoner
 *  - AI_MAX_RETRIES=4
 *  - AI_TIMEOUT_MS=30000
 */
export async function callOpenAIChat(options: {
  model?: string
  system: string
  user: string
  temperature?: number
}): Promise<string> {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase()

  const model =
    options.model ||
    process.env.AI_MODEL ||
    (provider === 'deepseek' ? 'deepseek-chat' : process.env.OPENAI_MODEL || 'gpt-4o-mini')

  const temperature = options.temperature ?? 0.2
  const maxRetries = clampInt(Number(process.env.AI_MAX_RETRIES ?? 4), 0, 8)
  const timeoutMs = clampInt(Number(process.env.AI_TIMEOUT_MS ?? 30_000), 5_000, 120_000)

  const { url, apiKey, headers } = getProviderConfig(provider)

  const body = {
    model,
    temperature,
    // DeepSeek supports OpenAI-compatible request format; json_object generally works.
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: options.system },
      { role: 'user', content: options.user },
    ],
  }

  return await fetchWithRetryJsonMessage({
    url,
    apiKey,
    headers,
    body,
    timeoutMs,
    maxRetries,
  })
}

/* -------------------------------- Internals ------------------------------- */

function getProviderConfig(provider: string): {
  url: string
  apiKey: string
  headers: Record<string, string>
} {
  if (provider === 'deepseek') {
    const apiKey = process.env.DEEPSEEK_API_KEY || process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('DEEPSEEK_API_KEY is missing')

    // DeepSeek OpenAI-compatible base_url: https://api.deepseek.com/v1 :contentReference[oaicite:3]{index=3}
    const baseUrl = process.env.AI_BASE_URL || 'https://api.deepseek.com/v1'
    return {
      url: `${baseUrl}/chat/completions`,
      apiKey,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    }
  }

  // Default OpenAI
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new Error('OPENAI_API_KEY is missing')

  const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
  return {
    url: `${baseUrl}/chat/completions`,
    apiKey,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  }
}

async function fetchWithRetryJsonMessage(params: {
  url: string
  apiKey: string
  headers: Record<string, string>
  body: any
  timeoutMs: number
  maxRetries: number
}): Promise<string> {
  let attempt = 0
  let lastErr: any = null

  while (attempt <= params.maxRetries) {
    try {
      const res = await fetchWithTimeout(params.url, {
        method: 'POST',
        headers: params.headers,
        body: JSON.stringify(params.body),
      }, params.timeoutMs)

      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText)
        // Retry only on transient / throttling errors
        if (shouldRetryStatus(res.status) && attempt < params.maxRetries) {
          await sleep(backoffMs(attempt))
          attempt++
          continue
        }
        throw new Error(`AI provider error ${res.status}: ${text}`)
      }

      const json = await res.json()
      const message = json?.choices?.[0]?.message?.content
      if (!message || typeof message !== 'string') {
        throw new Error('AI provider returned an empty response')
      }
      return message
    } catch (err: any) {
      lastErr = err
      if (attempt < params.maxRetries) {
        await sleep(backoffMs(attempt))
        attempt++
        continue
      }
      break
    }
  }

  throw lastErr || new Error('AI provider request failed')
}

function shouldRetryStatus(status: number): boolean {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504
}

function backoffMs(attempt: number): number {
  // exponential backoff with jitter, capped
  const base = Math.min(8_000, 500 * Math.pow(2, attempt))
  const jitter = Math.floor(Math.random() * 250)
  return base + jitter
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const ac = new AbortController()
  const t = setTimeout(() => ac.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: ac.signal })
  } finally {
    clearTimeout(t)
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.trunc(n)))
}
