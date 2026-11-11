import { buildJobSlugHref, getShortStableIdForJobId } from '../../lib/jobs/jobSlug'
import { buildFeedItems } from '../../lib/jobs/latestFeed'
import { jobByClientId, publicJobId, toPublicJob } from '../../lib/jobs/publicJob'

// As stored for a job from a board feed: the internal id and source name the feed.
const job = {
  id: 'board:freehire:_159016280',
  title: 'Bauleiter Hochbau',
  company: 'ROCKEN',
  source: 'board:freehire',
  sourceRef: 'bauleiter-hochbau-159016280',
  externalId: ':159016280',
  dedupeKey: 'rocken:bauleiter-hochbau',
  sourcePriority: 20,
  createdAt: new Date('2026-11-10T00:00:00Z'),
  postedAt: new Date('2026-11-10T00:00:00Z'),
} as any

describe('public job (what leaves the server)', () => {
  it('uses the code at the end of the job URL as its id', () => {
    expect(publicJobId(job.id)).toBe(getShortStableIdForJobId(job.id))
    expect(buildJobSlugHref(job).endsWith(`-j-${publicJobId(job.id)}`)).toBe(true)
  })

  it('keeps the job’s link exactly as before and drops every source field', () => {
    const out = toPublicJob(job)
    expect(out.href).toBe(buildJobSlugHref(job))
    expect(out.id).toBe(publicJobId(job.id))
    for (const field of ['source', 'sourceRef', 'externalId', 'dedupeKey', 'sourcePriority']) expect(out).not.toHaveProperty(field)
    expect(out.title).toBe('Bauleiter Hochbau')
    expect(JSON.stringify(out)).not.toMatch(/freehire/i)
  })

  it('gives homepage feed items the public id', () => {
    const [item] = buildFeedItems([job])
    expect(item.id).toBe(publicJobId(job.id))
    expect(JSON.stringify(item)).not.toMatch(/freehire/i)
  })

  it('finds a job by its public id or, from older pages, its internal id', () => {
    expect(jobByClientId('abc123')).toEqual({ OR: [{ shortId: 'abc123' }, { id: 'abc123' }] })
  })
})
