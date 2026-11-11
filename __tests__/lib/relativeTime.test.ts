import { formatRelativeTime } from '../../lib/utils/time'

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-11-11T12:00:00Z')
  const ago = (ms: number) => new Date(now - ms)
  const H = 3_600_000
  const D = 24 * H

  it('uses one compact style at every age', () => {
    expect(formatRelativeTime(ago(5 * 60_000), now)).toBe('just now')
    expect(formatRelativeTime(ago(3 * H), now)).toBe('3h ago')
    expect(formatRelativeTime(ago(4 * D), now)).toBe('4d ago')
    expect(formatRelativeTime(ago(29 * D), now)).toBe('29d ago')
    expect(formatRelativeTime(ago(70 * D), now)).toBe('2mo ago')
    expect(formatRelativeTime(new Date('2023-12-09T00:00:00Z'), now)).toBe('2y ago')
  })

  it('never falls back to a locale date', () => {
    expect(formatRelativeTime(ago(200 * D), now)).not.toMatch(/\//)
  })

  it('treats the future as just now and rejects bad input', () => {
    expect(formatRelativeTime(new Date(now + D), now)).toBe('just now')
    expect(formatRelativeTime(null, now)).toBeNull()
    expect(formatRelativeTime('not a date', now)).toBeNull()
  })
})
