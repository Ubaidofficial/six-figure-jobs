import type { AiEnrichOutput } from '../../lib/ai/aiEnrichPrompt'
import {
  DEFAULT_DAILY_MAX,
  FREE_AI_VERSION,
  buildJobUpdate,
  descriptionKey,
  groupByDescription,
  normalizeEnrichment,
  parseLimit,
  remainingToday,
  startOfUtcDay,
} from '../../lib/ai/freeEnrichWrite'

const out = (over: Partial<AiEnrichOutput> = {}): AiEnrichOutput => ({
  oneLiner: 'Lead payments infrastructure for a fast-growing fintech platform.',
  snippet: 'Own the services that move money for marketplace customers.',
  bullets: ['Own the payments platform roadmap end to end'],
  description: ['Design and run the services that move money for customers'],
  requirements: ['5+ years building backend services in production'],
  benefits: ['Annual compensation range: $265,000 - $335,000 USD'],
  techStack: ['Python', 'AWS'],
  ...over,
})

describe('the daily budget', () => {
  it('lets a run do at most its limit, never past the day maximum', () => {
    expect(remainingToday(80, 0, 40)).toBe(40)
    expect(remainingToday(80, 60, 40)).toBe(20)
    expect(remainingToday(80, 80, 40)).toBe(0)
    expect(remainingToday(80, 95, 40)).toBe(0)
    expect(DEFAULT_DAILY_MAX).toBe(80)
  })

  it('reads a limit as a whole number in range, else the default', () => {
    expect(parseLimit('25', 40, 100)).toBe(25)
    expect(parseLimit('500', 40, 100)).toBe(100)
    expect(parseLimit('0', 40, 100)).toBe(40)
    expect(parseLimit('abc', 40, 100)).toBe(40)
    expect(parseLimit(undefined, 40, 100)).toBe(40)
  })

  it('resets at midnight UTC', () => {
    expect(startOfUtcDay(new Date('2026-11-14T22:30:12Z')).toISOString()).toBe('2026-11-14T00:00:00.000Z')
  })
})

describe('one model call per distinct description', () => {
  it('gives the same key to a repost with different spacing and case', () => {
    expect(descriptionKey('Build  the Payments platform.')).toBe(descriptionKey('build the payments platform.'))
    expect(descriptionKey('Build the payments platform.')).not.toBe(descriptionKey('Build the search platform.'))
  })

  it('groups reposts together and keeps input order', () => {
    const jobs = [
      { id: 'a', text: 'Staff engineer, payments. Build things.' },
      { id: 'b', text: 'Designer. Draw things.' },
      { id: 'c', text: 'staff engineer,  payments. build things.' },
      { id: 'd', text: '' },
    ]
    const groups = [...groupByDescription(jobs, (j) => j.text).values()].map((g) => g.map((j) => j.id))
    expect(groups).toEqual([['a', 'c'], ['b']])
  })
})

describe('normalizeEnrichment', () => {
  it('labels a preferred requirement so it never reads as required', () => {
    const n = normalizeEnrichment(out({ requirements: ['At least 8 years of relevant legal experience preferred.', '3+ years of experience with SQL', 'Nice to have: Kubernetes experience'] }))
    expect(n.requirements).toEqual([
      'Preferred: At least 8 years of relevant legal experience preferred.',
      '3+ years of experience with SQL',
      'Preferred: Nice to have: Kubernetes experience',
    ])
  })

  it('does not double-label and strips bullet glyphs and spacing', () => {
    const n = normalizeEnrichment(out({ requirements: ['Preferred: a degree in computer science', '•   Experience  with   Python  services'] }))
    expect(n.requirements).toEqual(['Preferred: a degree in computer science', 'Experience with Python services'])
  })

  it('drops empty, tiny and overlong bullets', () => {
    const n = normalizeEnrichment(out({ description: ['', 'ok', 'Design and run the services that move money', 'x'.repeat(400)] }))
    expect(n.description).toEqual(['Design and run the services that move money'])
  })
})

describe('buildJobUpdate', () => {
  const now = new Date('2026-11-14T22:40:00Z')

  it('writes the fields the job page reads, tagged as free-v1', () => {
    const u = buildJobUpdate(out(), { techStack: null }, 'cloudflare:@cf/meta/llama-3.1-8b-instruct', now)
    expect(u).toMatchObject({
      aiOneLiner: 'Lead payments infrastructure for a fast-growing fintech platform.',
      aiSnippet: 'Own the services that move money for marketplace customers.',
      aiSummaryJson: {
        bullets: ['Own the payments platform roadmap end to end'],
        description: ['Design and run the services that move money for customers'],
        requirements: ['5+ years building backend services in production'],
        benefits: ['Annual compensation range: $265,000 - $335,000 USD'],
      },
      aiModel: 'cloudflare:@cf/meta/llama-3.1-8b-instruct',
      aiVersion: FREE_AI_VERSION,
      aiEnrichedAt: now,
      lastAiEnrichedAt: now,
    })
    expect(u.techStack).toBe('["Python","AWS"]')
  })

  it('never replaces a tech stack the job already has', () => {
    const u = buildJobUpdate(out(), { techStack: '["Go"]' }, 'm', now)
    expect('techStack' in u).toBe(false)
  })

  it('does not touch the description', () => {
    const u = buildJobUpdate(out(), { techStack: null }, 'm', now) as Record<string, unknown>
    expect('descriptionHtml' in u).toBe(false)
  })
})
