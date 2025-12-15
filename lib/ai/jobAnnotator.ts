// lib/ai/jobAnnotator.ts
import { callDeepSeekChat } from './deepseekClient'

export type JobAnnotation = {
  summary: string | null
  bullets: string[]
  techStack: string[]
  keywords: string[]
}

const SYSTEM_PROMPT = `
You are a factual, conservative information extraction system for a high-salary job board.

Hard Rules:
- Do NOT invent facts (salary, benefits, location, company, sponsorship).
- Use ONLY what is in the provided description text.
- Output STRICT JSON only. No markdown. No code fences.
- If information is not present, omit or output empty arrays/null.

Schema (keys ONLY):
{
  "summary": string|null,          // 1 sentence, max 26 words, plain text
  "bullets": string[],             // up to 4 concise bullets, deduped
  "techStack": string[],           // 3-8 lowercase technologies explicitly mentioned
  "keywords": string[]             // 3-8 topical keywords grounded in explicit terms
}
`.trim()

export async function annotateJobWithAI(input: {
  title: string
  description: string
}): Promise<JobAnnotation> {
  const userPrompt = `
Title: ${input.title}

Description:
${input.description}
`.trim()

  const raw = await callDeepSeekChat({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    temperature: 0.2,
  })

  const cleaned = extractFirstJsonObject(raw)

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (e: any) {
    // include a tiny snippet to debug without spamming logs
    const snippet = String(raw || '').slice(0, 220)
    throw new Error(`Failed to parse AI JSON: ${e?.message || e}. RawHead="${snippet}"`)
  }

  const summary = cleanString(parsed.summary)
  const bullets = cleanStringArray(parsed.bullets).slice(0, 4)

  // Filter tech to “real” terms; drop weak tokens like "ai"
  const techStackRaw = cleanLowerStringArray(parsed.techStack)
  const techStack = filterRealTech(techStackRaw).slice(0, 10)

  const keywords = cleanLowerStringArray(parsed.keywords).slice(0, 10)

  return { summary, bullets, techStack, keywords }
}

function extractFirstJsonObject(text: string): string {
  const s = (text || '').trim()

  // Remove ```json fences if present
  const unfenced = s
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

  // Extract first { ... } (handles extra prose)
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return unfenced
  return unfenced.slice(start, end + 1)
}

function cleanString(v: any): string | null {
  if (typeof v !== 'string') return null
  const s = v.trim()
  if (!s) return null
  return s.replace(/^["'`]+|["'`]+$/g, '')
}

function cleanStringArray(v: any): string[] {
  if (!Array.isArray(v)) return []
  return v
    .map((x) => (typeof x === 'string' ? x.trim() : ''))
    .filter((x) => x.length > 0)
}

function cleanLowerStringArray(v: any): string[] {
  if (!Array.isArray(v)) return []
  const out: string[] = []
  const seen = new Set<string>()
  for (const x of v) {
    if (typeof x !== 'string') continue
    const s = x.trim().toLowerCase()
    if (!s || seen.has(s)) continue
    seen.add(s)
    out.push(s)
  }
  return out
}

function filterRealTech(items: string[]): string[] {
  const stop = new Set([
    'ai',
    'ml',
    'cloud',
    'infrastructure',
    'platform',
    'systems',
    'automation',
    'devops',
  ])

  const out: string[] = []
  for (const t of items) {
    if (!t) continue
    if (stop.has(t)) continue
    if (t.length < 3) continue
    out.push(t)
  }
  return out
}
