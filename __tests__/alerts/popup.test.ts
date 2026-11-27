import { isExitIntent, listAlertAfterIndex, popupAllowedOnPath, popupIsSnoozed } from '@/lib/alerts/popup'

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

describe('isExitIntent', () => {
  it('fires only when the mouse leaves the document through the top edge', () => {
    expect(isExitIntent({ clientY: 0, relatedTarget: null })).toBe(true)
    expect(isExitIntent({ clientY: -3, relatedTarget: null })).toBe(true)
    expect(isExitIntent({ clientY: 400, relatedTarget: null })).toBe(false) // left through a side or the bottom
    expect(isExitIntent({ clientY: 0, relatedTarget: {} })).toBe(false) // moved onto another element of the page
  })
})

describe('listAlertAfterIndex', () => {
  it('puts the box after the 10th row of a list of 15 or more, and none in a shorter list', () => {
    expect(listAlertAfterIndex(14)).toBeNull()
    expect(listAlertAfterIndex(15)).toBe(9)
    expect(listAlertAfterIndex(50)).toBe(9)
  })
})
