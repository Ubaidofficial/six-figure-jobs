export function buildAiEnrichPrompt(input: {
  title: string
  roleSnippet: string
  locationHint?: string
  maxOutputTokens: number
}): string {
  return `Extract and structure the following job posting into a clean JSON format.

Job Title: ${input.title}
${input.locationHint ? `Location: ${input.locationHint}` : ''}

Job Content:
${input.roleSnippet}

Parse this job posting and return ONLY valid JSON (no markdown, no extra text) with this exact structure:

{
  "oneLiner": "A single engaging sentence (max 180 chars) describing the core role",
  "snippet": "A 2-3 sentence summary (max 300 chars) highlighting what makes this role interesting",
  "description": [
    "List 5-10 clear bullet points describing key responsibilities",
    "Focus on day-to-day work, main projects, technical challenges",
    "What will the person actually be doing in this role"
  ],
  "requirements": [
    "List 5-10 bullet points covering required skills and qualifications",
    "Include years of experience, technical skills, education requirements",
    "Be specific about technologies, tools, and expertise needed"
  ],
  "benefits": [
    "List 3-8 bullet points about compensation, perks, and culture",
    "Include salary if mentioned, PTO, insurance, remote work",
    "Company culture highlights and unique benefits"
  ]
}

CRITICAL RULES:
- Return ONLY valid JSON, no markdown code blocks, no extra text
- Keep each bullet concise (1-2 lines maximum)
- Extract from the original posting, don't invent details
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

  const description = Array.isArray(parsed.description)
    ? parsed.description
        .filter((s: any) => s && String(s).trim())
        .map((s: any) => String(s).trim())
        .slice(0, 10)
    : []

  const requirements = Array.isArray(parsed.requirements)
    ? parsed.requirements
        .filter((s: any) => s && String(s).trim())
        .map((s: any) => String(s).trim())
        .slice(0, 10)
    : []

  const benefits = Array.isArray(parsed.benefits)
    ? parsed.benefits
        .filter((s: any) => s && String(s).trim())
        .map((s: any) => String(s).trim())
        .slice(0, 8)
    : []

  const bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets
        .filter((s: any) => s && String(s).trim())
        .map((s: any) => String(s).trim())
        .slice(0, 4)
    : []

  return {
    oneLiner: String(parsed.oneLiner || '').trim().slice(0, 180),
    snippet: String(parsed.snippet || '').trim().slice(0, 300),
    bullets,
    description,
    requirements,
    benefits,
  }
}
