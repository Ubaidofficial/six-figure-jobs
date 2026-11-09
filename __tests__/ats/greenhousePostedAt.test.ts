jest.mock('../../lib/scrapers/utils/fetchWithBackoff', () => ({
  fetchJsonWithBackoff: jest.fn(async () => ({
    jobs: [
      // The board API's fields, as returned live on 2026-11-09: `first_published`, never `first_published_at`.
      { id: 1, title: 'Engineer', absolute_url: 'https://x/1', first_published: '2026-06-26T17:37:46-04:00', updated_at: '2026-11-09T09:48:09-05:00' },
      { id: 2, title: 'Designer', absolute_url: 'https://x/2', updated_at: '2026-11-09T09:48:09-05:00' },
    ],
  })),
}))

import { scrapeGreenhouse } from '../../lib/scrapers/ats/greenhouse'

describe('Greenhouse posting date', () => {
  it('reads first_published, not the edit date', async () => {
    const [published, unknown] = await scrapeGreenhouse('https://boards.greenhouse.io/acme')
    expect(published.postedAt?.toISOString()).toBe('2026-06-26T21:37:46.000Z')
    expect(unknown.postedAt).toBeNull()
  })
})
