import { popupAllowedOnPath, popupIsSnoozed } from '@/lib/alerts/popup'

describe('popupAllowedOnPath', () => {
  it.each(['/', '/jobs', '/jobs/data-engineer', '/remote', '/salary/engineer', '/companies', '/high-paying-jobs'])(
    'allows %s',
    (p) => expect(popupAllowedOnPath(p)).toBe(true),
  )
  it.each(['/job/some-job-123', '/account', '/account/billing', '/sign-in', '/pricing', '/alerts/abc', '/ubaid93/alerts', '/privacy', '/terms', '/cookies', '/post-a-job', '/api/health'])(
    'blocks %s',
    (p) => expect(popupAllowedOnPath(p)).toBe(false),
  )
  it('does not confuse /jobs with /job/ or /accounts-like names', () => {
    expect(popupAllowedOnPath('/jobs')).toBe(true)
    expect(popupAllowedOnPath('/accountants')).toBe(true)
  })
})

describe('popupIsSnoozed', () => {
  const now = 1_000_000
  it('is snoozed only while the stored time is in the future', () => {
    expect(popupIsSnoozed(String(now + 1), now)).toBe(true)
    expect(popupIsSnoozed(String(now), now)).toBe(false)
    expect(popupIsSnoozed(String(now - 1), now)).toBe(false)
  })
  it('treats missing or unreadable values as not snoozed', () => {
    expect(popupIsSnoozed(null, now)).toBe(false)
    expect(popupIsSnoozed('', now)).toBe(false)
    expect(popupIsSnoozed('soon', now)).toBe(false)
  })
})
