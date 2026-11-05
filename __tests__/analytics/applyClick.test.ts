import { isBotUserAgent, validateApplyClick } from '../../lib/analytics/applyClick'

describe('validateApplyClick', () => {
  const ok = { jobId: 'board:freehire:abc', surface: 'apply-card', device: 'desktop' }
  it('accepts a valid click', () => {
    expect(validateApplyClick(ok)).toEqual(ok)
  })
  it('rejects unknown surfaces/devices, missing or oversized ids, and non-objects', () => {
    expect(validateApplyClick({ ...ok, surface: 'footer' })).toBeNull()
    expect(validateApplyClick({ ...ok, device: 'tablet' })).toBeNull()
    expect(validateApplyClick({ ...ok, jobId: '' })).toBeNull()
    expect(validateApplyClick({ ...ok, jobId: 'x'.repeat(81) })).toBeNull()
    expect(validateApplyClick({ ...ok, surface: '__proto__' })).toBeNull()
    expect(validateApplyClick(null)).toBeNull()
    expect(validateApplyClick('apply')).toBeNull()
  })
  it('ignores extra fields, so nothing unexpected can be stored', () => {
    expect(validateApplyClick({ ...ok, email: 'a@b.c', ip: '1.2.3.4' })).toEqual(ok)
  })
})

describe('isBotUserAgent', () => {
  it('flags crawlers, headless browsers, scripts and empty agents', () => {
    for (const ua of ['Googlebot/2.1', 'Mozilla/5.0 HeadlessChrome/120', 'curl/8.0.1', 'python-requests/2.31', 'Lighthouse', '', null, undefined, 'x']) {
      expect(isBotUserAgent(ua as string)).toBe(true)
    }
  })
  it('lets real browsers through', () => {
    expect(isBotUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')).toBe(false)
    expect(isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36')).toBe(false)
  })
})
