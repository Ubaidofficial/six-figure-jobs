import { normalizeTopCities } from '@/lib/roles/topCities'

const row = (slug: string, city: string, cc: string, count = 1) => ({ slug, city, cc, count, avg: 100 })

describe('normalizeTopCities', () => {
  it('names each city from the city list instead of the stored slug', () => {
    const [sf] = normalizeTopCities([row('san-francisco', 'san-francisco', 'US')])
    expect(sf.city).toBe('San Francisco')
  })

  it('lists a city once even when the database has it under two country codes, with the right country', () => {
    const out = normalizeTopCities([row('san-francisco', 'san-francisco', 'CA', 5), row('san-francisco', 'san-francisco', 'US', 9)])
    expect(out).toHaveLength(1)
    expect(out[0]).toMatchObject({ slug: 'san-francisco', city: 'San Francisco', cc: 'US', count: 5 })
  })

  it('drops a city that has no page, and keeps the order of the rest', () => {
    const out = normalizeTopCities([row('nowhere-ville', 'Nowhere Ville', 'US'), row('new-york', 'new-york', 'US'), row('seattle', 'seattle', 'US')])
    expect(out.map((c) => c.slug)).toEqual(['new-york', 'seattle'])
  })
})
