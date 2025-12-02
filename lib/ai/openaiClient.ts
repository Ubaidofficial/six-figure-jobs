// lib/ai/openaiClient.ts

/**
 * Minimal OpenAI chat client wrapper used by AI enrichment scripts.
 * Uses JSON mode for structured responses and keeps retries simple.
 */
export async function callOpenAIChat(options: {
  model?: string
  system: string
  user: string
  temperature?: number
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is missing')
  }

  const model = options.model || process.env.OPENAI_MODEL || 'gpt-4o-mini'

  const body = {
    model,
    temperature: options.temperature ?? 0.2,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: options.system },
      { role: 'user', content: options.user },
    ],
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`OpenAI error ${res.status}: ${text}`)
  }

  const json = await res.json()
  const message = json?.choices?.[0]?.message?.content
  if (!message || typeof message !== 'string') {
    throw new Error('OpenAI returned an empty response')
  }

  return message
}
