import { buildSponsorSlots, endOfDayUtc, httpsUrl } from '@/lib/sponsors/slots'

const now = new Date('2026-11-13T12:00:00Z')
const full = (n: number, over: Record<string, string> = {}) => ({
  [`sponsor.${n}.name`]: 'Acme Jobs',
  [`sponsor.${n}.text`]: 'Hire senior engineers faster.',
  [`sponsor.${n}.url`]: 'https://acme.example/hiring',
  [`sponsor.${n}.logo`]: 'https://acme.example/logo.png',
  [`sponsor.${n}.until`]: '2026-12-31',
  ...Object.fromEntries(Object.entries(over).map(([k, v]) => [`sponsor.${n}.${k}`, v])),
})

describe('endOfDayUtc', () => {
  it('is the last moment of that UTC day, and null for anything but a real YYYY-MM-DD date', () => {
    expect(endOfDayUtc('2026-12-31')?.toISOString()).toBe('2026-12-31T23:59:59.999Z')
    for (const bad of ['', undefined, '2026-02-31', '31-12-2026', '2026-1-5', 'tomorrow', '2026-13-01']) {
      expect(endOfDayUtc(bad)).toBeNull()
    }
  })
})

describe('httpsUrl', () => {
  it('accepts a plain https link only', () => {
    expect(httpsUrl('https://acme.example/x')?.hostname).toBe('acme.example')
    for (const bad of ['http://acme.example', 'javascript:alert(1)', 'data:text/html,hi', '/relative', 'acme.example', 'https://localhost', '', undefined]) {
      expect(httpsUrl(bad)).toBeNull()
    }
  })
})

describe('buildSponsorSlots', () => {
  it('shows a complete slot with UTM parameters added to its link', () => {
    const [slot] = buildSponsorSlots(full(1), now)
    expect(slot).toMatchObject({ id: 1, name: 'Acme Jobs', text: 'Hire senior engineers faster.', logo: 'https://acme.example/logo.png' })
    const url = new URL(slot.href)
    expect(url.origin + url.pathname).toBe('https://acme.example/hiring')
    expect(url.searchParams.get('utm_source')).toBe('6figjobs')
    expect(url.searchParams.get('utm_medium')).toBe('sponsored')
    expect(url.searchParams.get('utm_campaign')).toBe('slot-1')
  })

  it("keeps the sponsor's own UTM values", () => {
    const [slot] = buildSponsorSlots(full(1, { url: 'https://acme.example/?utm_source=jobboard&ref=1' }), now)
    const url = new URL(slot.href)
    expect(url.searchParams.get('utm_source')).toBe('jobboard')
    expect(url.searchParams.get('ref')).toBe('1')
  })

  it('shows through the whole last day and stops after it', () => {
    expect(buildSponsorSlots(full(1, { until: '2026-11-13' }), new Date('2026-11-13T23:59:00Z'))).toHaveLength(1)
    expect(buildSponsorSlots(full(1, { until: '2026-11-13' }), new Date('2026-11-14T00:00:01Z'))).toHaveLength(0)
  })

  it('needs a name, an https link and a last day; clearing the name hides the slot', () => {
    expect(buildSponsorSlots(full(1, { name: '' }), now)).toEqual([])
    expect(buildSponsorSlots(full(1, { url: 'http://acme.example' }), now)).toEqual([])
    expect(buildSponsorSlots(full(1, { url: 'javascript:alert(1)' }), now)).toEqual([])
    expect(buildSponsorSlots(full(1, { until: '' }), now)).toEqual([])
    expect(buildSponsorSlots({}, now)).toEqual([])
  })

  it('treats text and logo as optional, drops a bad logo, and cuts long text', () => {
    const [slot] = buildSponsorSlots(full(1, { text: '', logo: 'http://insecure.example/logo.png' }), now)
    expect(slot.text).toBeNull()
    expect(slot.logo).toBeNull()
    const [long] = buildSponsorSlots(full(1, { text: 'x'.repeat(300) }), now)
    expect(long.text).toHaveLength(140)
    expect(long.text?.endsWith('…')).toBe(true)
  })

  it('returns the active slots in slot order and ignores unknown slot numbers', () => {
    const slots = buildSponsorSlots({ ...full(2, { name: 'Second' }), ...full(1, { name: 'First' }), ...full(3, { name: 'Third' }) }, now)
    expect(slots.map((s) => s.name)).toEqual(['First', 'Second'])
  })
})
