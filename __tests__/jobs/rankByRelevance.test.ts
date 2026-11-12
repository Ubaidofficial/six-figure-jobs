import { rankByRelevance } from '@/lib/jobs/queryJobs'

const DAY = 24 * 60 * 60 * 1000
const now = Date.UTC(2026, 10, 12)

describe('rankByRelevance', () => {
  it('puts jobs tagged New (posted in the last 3 days) before older matches, whatever their score', () => {
    const ids = rankByRelevance(
      [
        { id: 'old-strong', score: 9, posted: now - 20 * DAY },
        { id: 'new-weak', score: 1, posted: now - 2 * DAY },
        { id: 'new-strong', score: 9, posted: now - 1 * DAY },
        { id: 'old-weak', score: 1, posted: now - 10 * DAY },
      ],
      now,
    )
    expect(ids).toEqual(['new-strong', 'new-weak', 'old-strong', 'old-weak'])
  })

  it('orders by score, then posting date, inside each group', () => {
    const ids = rankByRelevance(
      [
        { id: 'a', score: 3, posted: now - 5 * DAY },
        { id: 'b', score: 3, posted: now - 4 * DAY },
        { id: 'c', score: 5, posted: now - 30 * DAY },
      ],
      now,
    )
    expect(ids).toEqual(['c', 'b', 'a'])
  })
})
