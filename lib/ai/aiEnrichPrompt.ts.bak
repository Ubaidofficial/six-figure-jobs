import { z } from 'zod'

export const AiEnrichSchema = z.object({
  oneLiner: z.string().min(20).max(180),
  snippet: z.string().min(40).max(280),
  bullets: z.array(z.string().min(10).max(140)).min(2).max(4),
})

export type AiEnrichOutput = z.infer<typeof AiEnrichSchema>

export function buildAiEnrichPrompt(input: {
  title: string
  roleSnippet: string
  locationHint?: string
}): string {
  const { title, roleSnippet, locationHint } = input

  return [
    'You are writing short, role-focused summaries for a high-salary job board.',
    'Rules:',
    '- Be role-centric. Do NOT describe the company, mission, culture, perks, or boilerplate.',
    '- Do NOT mention company name unless it is essential for role clarity (usually not).',
    '- Avoid generic phrases: "fast-paced", "team player", "we are looking for".',
    '- Keep oneLiner ~140 chars, snippet ~200 chars. No emojis.',
    '- Deterministic-ish: prefer concrete responsibilities/stack from the snippet.',
    '',
    'Return STRICT JSON only with keys: oneLiner, snippet, bullets.',
    '',
    `Title: ${title}`,
    locationHint ? `Location hint: ${locationHint}` : '',
    '',
    'Role context (cleaned):',
    roleSnippet.slice(0, 1200),
  ]
    .filter(Boolean)
    .join('\n')
}

export function parseAiEnrichJson(text: string): AiEnrichOutput {
  const trimmed = text.trim()
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('AI output not JSON')
  }
  const jsonText = trimmed.slice(firstBrace, lastBrace + 1)
  const parsed = JSON.parse(jsonText)
  return AiEnrichSchema.parse(parsed)
}
