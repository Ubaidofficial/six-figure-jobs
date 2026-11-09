import type { ScrapedJobInput } from '../../lib/ingest/types'

jest.mock('../../lib/prisma', () => ({ prisma: {} }))

import { processLocation } from '../../lib/ingest/index'
import { readAshbyWorkplaceType, scrapeAshby } from '../../lib/scrapers/ats/ashby'

// Ashby marks hybrid jobs `isRemote: true` too: on 2026-11-09, 533 of OpenAI's 814 jobs were isRemote with
// workplaceType "Hybrid" and location "San Francisco", and they were stored and shown as remote.
describe('Ashby workplace type', () => {
  const originalFetch = globalThis.fetch
  afterEach(() => {
    globalThis.fetch = originalFetch
    jest.restoreAllMocks()
  })

  it('reads Remote, Hybrid and OnSite, and nothing else', () => {
    expect(readAshbyWorkplaceType('Remote')).toBe('remote')
    expect(readAshbyWorkplaceType('Hybrid')).toBe('hybrid')
    expect(readAshbyWorkplaceType('OnSite')).toBe('onsite')
    expect(readAshbyWorkplaceType(null)).toBeNull()
    expect(readAshbyWorkplaceType('Flexible')).toBeNull()
  })

  it('does not call a hybrid job remote although Ashby says isRemote', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
    const posting = (id: string, extra: Record<string, unknown>) => ({
      id,
      title: `Engineer ${id}`,
      jobUrl: `https://jobs.ashbyhq.com/acme/${id}`,
      descriptionHtml: '<p>Build things.</p>',
      ...extra,
    })
    globalThis.fetch = jest.fn(async () =>
      new Response(
        JSON.stringify({
          jobs: [
            posting('hybrid', { location: 'San Francisco', isRemote: true, workplaceType: 'Hybrid' }),
            posting('remote', { location: 'US - Remote', isRemote: true, workplaceType: 'Remote' }),
            posting('legacy', { location: 'New York', isRemote: true }),
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    ) as any

    const jobs = await scrapeAshby('https://jobs.ashbyhq.com/acme')
    const byId = Object.fromEntries(jobs.map((j) => [j.externalId, j]))
    expect(byId.hybrid).toMatchObject({ remote: null, workplaceType: 'hybrid' })
    expect(byId.remote).toMatchObject({ remote: true, workplaceType: 'remote' })
    // No workplace type: the isRemote flag is all there is.
    expect(byId.legacy).toMatchObject({ remote: true, workplaceType: null })
  })
})

describe('processLocation with a workplace type', () => {
  const job = (over: Partial<ScrapedJobInput>): ScrapedJobInput =>
    ({ externalId: 'x', title: 'Engineer', source: 'ats:ashby', rawCompanyName: 'Acme', url: 'https://example.com/x', ...over }) as ScrapedJobInput

  it('lets the workplace type decide over the isRemote flag', () => {
    expect(processLocation(job({ locationText: 'San Francisco', isRemote: true, workplaceType: 'hybrid' }))).toMatchObject({
      isRemote: false,
      remoteMode: 'hybrid',
    })
    expect(processLocation(job({ locationText: 'San Francisco', isRemote: true, workplaceType: 'onsite' }))).toMatchObject({
      isRemote: false,
      remoteMode: 'onsite',
    })
    expect(processLocation(job({ locationText: 'United States', workplaceType: 'remote' }))).toMatchObject({
      isRemote: true,
      remoteMode: 'remote',
    })
  })

  it('works as before without one', () => {
    expect(processLocation(job({ locationText: 'San Francisco', isRemote: true }))).toMatchObject({ isRemote: true, remoteMode: 'remote' })
  })
})
