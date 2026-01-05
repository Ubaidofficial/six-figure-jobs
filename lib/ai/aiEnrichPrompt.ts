export function buildAiEnrichPrompt(input: {
  title: string
  roleSnippet: string
  locationHint?: string
  maxOutputTokens: number
}): string {
  return `Extract and rewrite this job posting into a premium, role-focused summary in RemoteRocketship style.

Job Title: ${input.title}
${input.locationHint ? `Location: ${input.locationHint}` : ''}

Job Content:
${input.roleSnippet}

Return ONLY valid JSON (no markdown, no extra text) with this exact structure:

{
  "oneLiner": "A single engaging sentence (max 180 chars) describing the core role",
  "snippet": "A 2-3 sentence role summary (max 300 chars). No company bio/mission.",
  "bullets": [
    "3-5 short, punchy highlights about the role (role-focused, not company marketing)"
  ],
  "description": [
    "2 short paragraphs rewritten professionally (clear, structured, role-focused)"
  ],
  "requirements": [
    "5-8 bullets: technical skills, experience, education/certs if stated"
  ],
  "benefits": [
    "3-6 bullets: compensation, equity, PTO, remote setup, perks (ONLY if mentioned)"
  ],
  "techStack": [
    "3-10 technologies explicitly mentioned (canonical names like React, Node.js, PostgreSQL)"
  ],
  "skills": [
    "6-12 skill tags grounded in the text (mix tech + responsibilities like API design)"
  ]
}

CRITICAL RULES:
- Return ONLY valid JSON, no markdown code blocks, no extra text
- Do NOT invent details (salary, benefits, sponsorship, remote policy, tech)
- Keep bullets concise (1-2 lines max)
- Keep paragraphs short (2-3 sentences each)
- If a section has no information, use empty array: []
- Maintain technical accuracy
- Use active voice and present tense
- No emojis or special characters in the output`
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
