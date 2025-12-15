// lib/ai/deepseekClient.ts
import 'dotenv/config'

type DeepSeekChatOpts = {
  system: string
  user: string
  temperature?: number
}

/**
 * DeepSeek chat client with:
 * - model guard
 * - retry + exponential backoff
 * - basic rate limiting via env
 */
export async function callDeepSeekChat(opts: DeepSeekChatOpts): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) throw new Error('DEEPSEEK_API_KEY is missing')

  const model = process.env.AI_MODEL ?? 'deepseek-chat'
  const allowed = new Set(['deepseek-chat', 'deepseek-reasoner'])
  if (!allowed.has(model)) {
    throw new Error(`Invalid AI_MODEL=${model}. Use deepseek-chat or deepseek-reasoner.`)
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com'
  const url = `${baseUrl}/v1/chat/completions`

  // Cost controls / rate limits
  const maxRetries = clampInt(Number(process.env.AI_MAX_RETRIES ?? 4), 0, 8)
  const minDelayMs = clampInt(Number(process.env.AI_MIN_DELAY_MS ?? 250), 0, 5_000)
  const maxDelayMs = clampInt(Number(process.env.AI_MAX_DELAY_MS ?? 6_000), 500, 30_000)

  await sleep(minDelayMs)

  let attempt = 0
  let lastErr: any = null

  while (attempt <= maxRetries) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          temperature: opts.temperature ?? 0.2,
          messages: [
            { role: 'system', content: opts.system },
            { role: 'user', content: opts.user },
          ],
        }),
      })

      if (!res.ok) {
        const text = await res.text().catch(() => '')
        const msg = `DeepSeek error ${res.status}: ${text || res.statusText}`

        // Retry on 429/5xx
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(msg)
          attempt++
          const delay = backoffDelay(attempt, minDelayMs, maxDelayMs)
          await sleep(delay)
          continue
        }

        throw new Error(msg)
      }

      const json: any = await res.json()
      const message = json?.choices?.[0]?.message?.content
      if (!message || typeof message !== 'string') {
        throw new Error('DeepSeek returned an empty response')
      }
      return message
    } catch (err: any) {
      lastErr = err
      attempt++
      if (attempt > maxRetries) break
      const delay = backoffDelay(attempt, minDelayMs, maxDelayMs)
      await sleep(delay)
    }
  }

  throw lastErr ?? new Error('DeepSeek request failed')
}

function backoffDelay(attempt: number, minDelayMs: number, maxDelayMs: number) {
  // exponential backoff with jitter
  const exp = Math.min(maxDelayMs, minDelayMs * Math.pow(2, attempt))
  const jitter = Math.floor(Math.random() * Math.min(500, exp / 3))
  return Math.min(maxDelayMs, exp + jitter)
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min
  return Math.max(min, Math.min(max, Math.trunc(n)))
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}
