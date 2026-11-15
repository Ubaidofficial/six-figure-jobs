import { buildLocationDisplay } from '@/components/jobs/JobCard'

jest.mock('@/components/jobs/JobCard.module.css', () => ({ __esModule: true, default: new Proxy({}, { get: (_t, key) => String(key) }) }))

const job = (over: Record<string, unknown>) =>
  ({ remote: false, remoteMode: null, countryCode: null, locationsJson: null, ...over }) as any

describe('buildLocationDisplay flag', () => {
  it('flags the country the text names, not a disagreeing stored code', () => {
    const r = buildLocationDisplay(job({ primaryLocation: 'Dublin, Ireland', countryCode: 'GB' }))
    expect(r?.countryCode).toBe('IE')
  })
  it('falls back to the stored code when the text names no country', () => {
    const r = buildLocationDisplay(job({ primaryLocation: 'Berlin', countryCode: 'DE' }))
    expect(r?.countryCode).toBe('DE')
  })
  it('gives no flag when neither says', () => {
    const r = buildLocationDisplay(job({ primaryLocation: 'Berlin' }))
    expect(r?.countryCode).toBeNull()
  })
})
