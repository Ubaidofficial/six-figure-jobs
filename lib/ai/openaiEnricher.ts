import OpenAI from 'openai'
import { buildAiEnrichPrompt, parseAiEnrichJson, type AiEnrichOutput } from './aiEnrichPrompt'

const client = new OpenAI({ 
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: 'https://api.deepseek.com'
})

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function enrichJobWithAI(input: {
  title: string
  roleSnippet: string
  locationHint?: string
  maxOutputTokens: number
}): Promise<{ out: AiEnrichOutput; tokensIn: number; tokensOut: number }> {
  const model = process.env.AI_ENRICH_MODEL || 'deepseek-chat'
  const prompt = buildAiEnrichPrompt(input)
  const attempts = 4
  let lastErr: unknown

  for (let i = 0; i < attempts; i++) {
    try {
      const resp = await client.chat.completions.create({
        model,
        temperature: 0.2,
        max_tokens: input.maxOutputTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Return only valid JSON. No markdown. No extra keys.' },
          { role: 'user', content: prompt },
        ],
      })

      const text = resp.choices?.[0]?.message?.content || ''
      const out = parseAiEnrichJson(text)
      const tokensIn = resp.usage?.prompt_tokens ?? 0
      const tokensOut = resp.usage?.completion_tokens ?? 0

      return { out, tokensIn, tokensOut }
    } catch (e) {
      lastErr = e
      const backoff = Math.min(8000, 500 * Math.pow(2, i))
      await sleep(backoff)
    }
  }

  throw lastErr instanceof Error ? lastErr : new Error('AI enrich failed')
}
