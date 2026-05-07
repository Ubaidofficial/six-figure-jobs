export function buildAiEnrichPrompt(input: {
  title: string
  roleSnippet: string
  locationHint?: string
  maxOutputTokens: number
}): string {
  return `Extract and rewrite this job posting into a concise, role-focused summary. Each section should be SHORT bullet points — not paragraphs.

Job Title: ${input.title}
${input.locationHint ? `Location: ${input.locationHint}` : ''}

Job Content:
${input.roleSnippet}

Return ONLY valid JSON (no markdown, no extra text) with this exact structure:

{
  "oneLiner": "One engaging sentence (max 160 chars) describing what makes this role unique",
  "snippet": "2-3 sentence role summary (max 280 chars). Focus on what you will do, not company history.",
  "bullets": [
    "3-5 punchy one-liners about the role scope or impact (e.g. 'Lead API architecture for 10M+ users')"
  ],
  "description": [
    "5-6 concise bullets covering day-to-day responsibilities — what will you actually do? (10-20 words each)"
  ],
  "requirements": [
    "6-8 bullets: specific technical skills, years of experience, must-have qualifications (10-20 words each)"
  ],
  "benefits": [
    "4-5 bullets: compensation, equity, PTO, remote/hybrid, health, perks — ONLY extract what is explicitly stated"
  ],
  "techStack": [
    "3-10 technologies explicitly named (canonical: React, Node.js, PostgreSQL, AWS, etc.)"
  ],
  "skills": [
    "6-12 skill tags grounded in the text (mix: tech + soft skills + domain like 'API design', 'cross-functional')"
  ]
}

RULES:
- Return ONLY valid JSON. No markdown, no code blocks, no extra text.
- Every bullet must be a complete phrase (not a fragment). Active voice, present tense.
- Do NOT invent anything not stated: no fake salary, benefits, remote policy, or tech stack.
- description and requirements MUST always have content if the job posting has responsibilities or qualifications.
- Scan the FULL job content including the bottom — requirements and benefits are often listed after the intro.
- No emojis or special characters.`
}

export type AiEnrichOutput = {
  oneLiner: string
  snippet: string
  bullets?: string[] // Backwards compatibility with old data
  description: string[]
  requirements: string[]
  benefits: string[]
  techStack?: string[]
  skills?: string[]
}

export function parseAiEnrichJson(raw: string): AiEnrichOutput {
  let parsed: any
  try {
    const cleaned = raw
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('AI returned invalid JSON')
  }

  if (!parsed.oneLiner || !parsed.snippet) {
    throw new Error('AI response missing required fields')
  }

  const cleanArray = (v: any): string[] => {
    if (!Array.isArray(v)) return []
    const out: string[] = []
    const seen = new Set<string>()
    for (const item of v) {
      if (item == null) continue
      const s = String(item).trim()
      if (!s) continue
      const key = s.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      out.push(s)
    }
    return out
  }

  const description = Array.isArray(parsed.description)
    ? cleanArray(parsed.description).slice(0, 8)
    : []

  const requirements = Array.isArray(parsed.requirements)
    ? cleanArray(parsed.requirements).slice(0, 12)
    : []

  const benefits = Array.isArray(parsed.benefits)
    ? cleanArray(parsed.benefits).slice(0, 12)
    : []

  const bullets = Array.isArray(parsed.bullets)
    ? cleanArray(parsed.bullets).slice(0, 6)
    : []

  const techStack = Array.isArray(parsed.techStack)
    ? cleanArray(parsed.techStack).slice(0, 16)
    : []

  const skills = Array.isArray(parsed.skills)
    ? cleanArray(parsed.skills).slice(0, 24)
    : []

  return {
    oneLiner: String(parsed.oneLiner || '').trim().slice(0, 180),
    snippet: String(parsed.snippet || '').trim().slice(0, 300),
    bullets,
    description,
    requirements,
    benefits,
    techStack,
    skills,
  }
}
