// The job page's alert card (lib/alerts/jobAlertCard.ts, owner's choice 2026-11-25): when it shows and what it says.
import { JOB_CARD_DELAY_MS, jobCardDue, jobCardHeadline, jobCardHidden } from '../../lib/alerts/jobAlertCard'

describe('job page alert card', () => {
  it('opens after the delay or half-way down the page, not before', () => {
    expect(jobCardDue(0, 0)).toBe(false)
    expect(jobCardDue(JOB_CARD_DELAY_MS - 1, 0.49)).toBe(false)
    expect(jobCardDue(JOB_CARD_DELAY_MS, 0)).toBe(true)
    expect(jobCardDue(1000, 0.5)).toBe(true)
  })
  it('stays away from visitors who signed up, and only from them', () => {
    const now = Date.parse('2026-11-25T12:00:00Z')
    expect(jobCardHidden(String(now + 1000), now)).toBe(true)
    expect(jobCardHidden(String(now - 1000), now)).toBe(false)
    expect(jobCardHidden(null, now)).toBe(false)
    expect(jobCardHidden('garbage', now)).toBe(false)
  })
  it('leads with how many matching jobs came in this week when known', () => {
    expect(jobCardHeadline(37, 'Software Engineer jobs')).toBe('37 new Software Engineer jobs this week')
    expect(jobCardHeadline(1, 'Software Engineer jobs')).toBe('New Software Engineer jobs, straight to your inbox')
    expect(jobCardHeadline(null, 'Six-figure jobs')).toBe('New Six-figure jobs, straight to your inbox')
  })
})
