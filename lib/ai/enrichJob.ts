// lib/ai/enrichJob.ts

import OpenAI from 'openai'

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY!,
  baseURL: 'https://api.deepseek.com',
})

interface EnrichedJobData {
  description: string[]
  requirements: string[]
  benefits: string[]
  techStack: string[]
  seniority: string
  discipline: string
  isManager: boolean
  remote: boolean
}

export async function enrichJobWithAI(job: {
  title: string
  company: string
  locationText: string | null
  salaryMin: number | null
  salaryMax: number | null
  salaryCurrency: string | null
  descriptionHtml: string | null
  descriptionText: string | null
}): Promise<EnrichedJobData> {
  
  const description = job.descriptionHtml || job.descriptionText || ''
  
  // Truncate to 8000 chars to stay under token limit
  const truncatedDesc = description.slice(0, 8000)
  
  const prompt = `Extract structured data from this job posting in RemoteRocketship style.

Title: ${job.title}
Company: ${job.company}
Location: ${job.locationText || 'Remote'}
Salary: ${job.salaryMin && job.salaryMax ? `$${job.salaryMin}k-$${job.salaryMax}k` : 'Not specified'}

Description:
${truncatedDesc}

Return ONLY valid JSON (no markdown):
{
  "description": ["• Responsibility 1", "• Responsibility 2", "• Responsibility 3", "• Responsibility 4"],
  "requirements": ["• Requirement 1", "• Requirement 2", "• Requirement 3", "• Requirement 4", "• Requirement 5", "• Requirement 6"],
  "benefits": ["• Benefit 1", "• Benefit 2", "• Benefit 3", "• Benefit 4", "• Benefit 5", "• Benefit 6", "• Benefit 7", "• Benefit 8"],
  "techStack": ["Python", "React"],
  "seniority": "Senior",
  "discipline": "Backend",
  "isManager": false,
  "remote": true
}

Rules:
- 4-5 description bullets (what they'll do)
- 6-8 requirement bullets (qualifications)
- 8-10 benefit bullets (perks, remote, salary, equity, etc)
- Only tech mentioned in description
- Seniority: Junior|Mid|Senior|Staff|Principal|Lead|Manager|Director
- Discipline: Backend|Frontend|Full-stack|DevOps|Platform|Data|ML|Security|Mobile
- Return ONLY JSON, no markdown backticks`

  try {
    const response = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1000,
      temperature: 0.2,
    })

    const content = response.choices[0]?.message?.content
    if (!content) {
      throw new Error('No response from DeepSeek')
    }

    // Strip markdown if present
    let jsonStr = content.trim()
    jsonStr = jsonStr.replace(/^```json\n?/, '').replace(/\n?```$/, '')

    return JSON.parse(jsonStr)
    
  } catch (err) {
    console.error('[AI Enrichment] Error:', err)
    throw err
  }
}