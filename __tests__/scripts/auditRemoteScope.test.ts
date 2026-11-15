import { compareScope, storedScope } from '@/scripts/audit-remote-scope'

describe('remote scope audit comparison', () => {
  it('reads what is stored', () => {
    expect(storedScope({ countryCode: 'us', locationRaw: 'Remote' })).toEqual({ kind: 'country', code: 'US' })
    expect(storedScope({ countryCode: null, locationRaw: 'Anywhere in the world' })).toEqual({ kind: 'worldwide-text' })
    expect(storedScope({ countryCode: null, locationRaw: 'Remote' })).toEqual({ kind: 'undecided' })
  })
  it('classifies agreement, new information and conflict', () => {
    const us = { kind: 'countries' as const, countries: ['US'], quote: 'q' }
    expect(compareScope({ kind: 'country', code: 'US' }, us)).toBe('agree: country')
    expect(compareScope({ kind: 'country', code: 'DE' }, us)).toBe('CONFLICT: stored DE, description limits to US')
    expect(compareScope({ kind: 'undecided' }, us)).toBe('NEW: stored nothing, description limits to US')
    expect(compareScope({ kind: 'worldwide-text' }, us)).toContain('CONFLICT')
    expect(compareScope({ kind: 'country', code: 'US' }, { kind: 'worldwide', quote: 'q' })).toBe('CONFLICT: stored US, description worldwide')
    expect(compareScope({ kind: 'undecided' }, null)).toBe('description says nothing clear')
  })
})
