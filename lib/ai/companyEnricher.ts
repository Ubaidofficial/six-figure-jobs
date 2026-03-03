// lib/ai/companyEnricher.ts
import { callDeepSeekChat } from './deepseekClient'

export type CompanyEnrichment = {
  size: string | null // "1001-5000" format
  industry: string | null
  benefits: {
    healthInsurance: boolean
    retirement401k: boolean
    equity: boolean
    unlimited_pto: boolean
  }
}

const ALLOWED_SIZES = new Set(['11-50', '51-200', '201-1000', '1001-5000', '5000+'])

const SYSTEM_PROMPT = `
You are a factual, conservative information extraction system for enriching company metadata on a premium job board.

Hard Rules:
- Do NOT invent facts. Use ONLY what is explicitly stated or strongly implied in the provided job description text.
- If unsure about company size or industry, return null.
- Benefits booleans: set true ONLY if explicitly mentioned; otherwise false.
- Output STRICT JSON only. No markdown. No code fences. No explanations.
- Use the exact schema keys below.

What to extract:
- size: Infer the company employee range when possible (e.g., "1,000+ employees", "team of 200", "Fortune 500", "unicorn", "Series B").
- industry: Infer industry from company name + job context (e.g., "Fintech", "Healthcare", "E-commerce", "DevTools", "AI/ML").
- benefits: Detect explicit mentions in the text:
  - healthInsurance: "health insurance", "medical/dental/vision", "HSA"
  - retirement401k: "401k", "401(k)", "retirement plan", "pension"
  - equity: "equity", "RSU", "RSUs", "stock options", "options"
  - unlimited_pto: "unlimited PTO", "flexible time off"

Allowed size values (or null):
- "11-50"
- "51-200"
- "201-1000"
- "1001-5000"
- "5000+"

Schema (keys ONLY):
{
  "size": string|null,
  "industry": string|null,
  "benefits": {
    "healthInsurance": boolean,
    "retirement401k": boolean,
    "equity": boolean,
    "unlimited_pto": boolean
  }
}
`.trim()

export async function enrichCompanyWithAI(input: {
  companyName: string
  jobTitle?: string | null
  jobDescription: string
}): Promise<CompanyEnrichment> {
  const userPrompt = `
Company: ${input.companyName}
Role: ${input.jobTitle ?? ''}

Job description:
${input.jobDescription}
`.trim()

  const raw = await callDeepSeekChat({
    system: SYSTEM_PROMPT,
    user: userPrompt,
    temperature: 0.1,
  })

  const cleaned = extractFirstJsonObject(raw)

  let parsed: any
  try {
    parsed = JSON.parse(cleaned)
  } catch (e: any) {
    const snippet = String(raw || '').slice(0, 220)
    throw new Error(`Failed to parse AI JSON: ${e?.message || e}. RawHead="${snippet}"`)
  }

  const size = normalizeCompanySize(parsed.size)
  const industry = cleanIndustry(parsed.industry)
  const benefits = coerceBenefits(parsed.benefits)

  return { size, industry, benefits }
}

function extractFirstJsonObject(text: string): string {
  const s = (text || '').trim()

  const unfenced = s
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim()

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

function cleanIndustry(v: any): string | null {
  const s = cleanString(v)
  if (!s) return null
  if (s.length > 80) return null
  return s
}

function normalizeCompanySize(v: any): string | null {
  const s = cleanString(v)
  if (!s) return null

  const raw = s.replace(/\s+/g, ' ').trim()
  if (ALLOWED_SIZES.has(raw)) return raw

  const lowered = raw.toLowerCase()

  if (/\b(5000\+|5,000\+|10,000\+|10000\+)\b/.test(lowered)) return '5000+'
  if (/\b(1001\s*-\s*5000|1,001\s*-\s*5,000|1000\+|1,000\+)\b/.test(lowered)) return '1001-5000'
  if (/\b(201\s*-\s*1000|200\s*-\s*1000|201\+|200\+)\b/.test(lowered)) return '201-1000'
  if (/\b(51\s*-\s*200|50\s*-\s*200|51\+|50\+)\b/.test(lowered)) return '51-200'
  if (/\b(11\s*-\s*50|10\s*-\s*50|11\+|10\+)\b/.test(lowered)) return '11-50'

  return null
}

function coerceBoolean(v: any): boolean {
  if (typeof v === 'boolean') return v
  if (typeof v === 'number') return v !== 0
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase()
    if (s === 'true' || s === 'yes' || s === '1') return true
    if (s === 'false' || s === 'no' || s === '0') return false
  }
  return false
}

function coerceBenefits(v: any): CompanyEnrichment['benefits'] {
  const obj = v && typeof v === 'object' ? v : {}
  return {
    healthInsurance: coerceBoolean((obj as any).healthInsurance),
    retirement401k: coerceBoolean((obj as any).retirement401k),
    equity: coerceBoolean((obj as any).equity),
    unlimited_pto: coerceBoolean((obj as any).unlimited_pto ?? (obj as any).unlimitedPto),
  }
}

