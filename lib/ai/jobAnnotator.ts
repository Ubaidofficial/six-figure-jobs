// lib/ai/jobAnnotator.ts

import { callOpenAIChat } from './openaiClient'

export type JobAnnotation = {
  summary: string | null
  bullets: string[]
  techStack: string[]
  keywords: string[]
  experienceLevel: string | null
  workArrangement: string | null
  visaSponsorship: boolean | null
}

const SYSTEM_PROMPT = `
You are an expert tech recruiter. Given a job title and description, return a tight JSON payload with:
- summary: one sentence (max 26 words) written in plain text, no HTML.
- bullets: up to 4 crisp bullets highlighting responsibilities or requirements; avoid fluff.
- techStack: array of 3-8 lowercase tech terms (e.g., "python", "react", "aws").
- keywords: array of 3-8 topical keywords (ml, genai, fintech, security, payments, devops, healthcare, gaming, etc.).
- experienceLevel: one of entry, mid, senior, lead, executive (choose the best fit).
- workArrangement: remote, hybrid, or onsite (pick best guess).
- visaSponsorship: true if the description hints at sponsorship/visa support; false otherwise.

Return STRICT JSON with those keys only.
`

export async function annotateJobWithAI(input: {
  title: string
  description: string
}): Promise<JobAnnotation> {
  const userPrompt = `
Title: ${input.title}

Description:
${input.description}
`

  const raw = await callOpenAIChat({
    system: SYSTEM_PROMPT.trim(),
    user: userPrompt.trim(),
  })

  try {
    const parsed = JSON.parse(raw)
    return {
      summary: cleanString(parsed.summary) ?? null,
      bullets: Array.isArray(parsed.bullets)
        ? parsed.bullets.map(cleanString).filter(Boolean) as string[]
        : [],
      techStack: Array.isArray(parsed.techStack)
        ? parsed.techStack.map(cleanString).filter(Boolean) as string[]
        : [],
      keywords: Array.isArray(parsed.keywords)
        ? parsed.keywords.map(cleanString).filter(Boolean) as string[]
        : [],
      experienceLevel: cleanEnum(parsed.experienceLevel),
      workArrangement: cleanEnum(parsed.workArrangement),
      visaSponsorship:
        typeof parsed.visaSponsorship === 'boolean'
          ? parsed.visaSponsorship
          : null,
    }
  } catch (err: any) {
    throw new Error(`Failed to parse OpenAI response: ${err?.message || err}`)
  }
}

function cleanString(value: any): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Avoid lingering quotes or trailing punctuation
  return trimmed.replace(/^["']|["']$/g, '')
}

const ENUM_VALUES = new Set(['entry', 'mid', 'senior', 'lead', 'executive', 'remote', 'hybrid', 'onsite'])
function cleanEnum(value: any): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  return ENUM_VALUES.has(v) ? v : null
}
