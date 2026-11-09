import { capDescription, fitTitle } from '../../lib/seo/jobMeta'

describe('fitTitle', () => {
  it('keeps the full title with brand when it fits', () => {
    expect(fitTitle('Staff Engineer', 'Acme', '$200k–$250k/yr')).toBe(
      'Staff Engineer at Acme — $200k–$250k/yr | Six Figure Jobs',
    )
  })

  it('drops the brand, then the salary\'s /yr, before dropping anything the searcher cares about', () => {
    const title = fitTitle('Principal Software Engineer', 'Acme Robotics', '$200k–$250k/yr')
    expect(title).toBe('Principal Software Engineer at Acme Robotics — $200k–$250k')
    expect(title.length).toBeLessThanOrEqual(60)
  })

  it('drops the company but keeps the salary when role + company do not fit', () => {
    const title = fitTitle('Lead Software Engineer', 'Green Dot Corporation', '$140k–$199k/yr')
    expect(title).toBe('Lead Software Engineer — $140k–$199k/yr')
  })

  it('shortens a very long role rather than dropping the salary', () => {
    const title = fitTitle('Technical Program Manager, Omen Mission Systems', 'Anduril', '$166k–$220k/yr')
    expect(title).toBe('Technical Program Manager, Omen Mission… — $166k–$220k')
    expect(title.length).toBeLessThanOrEqual(60)
  })

  it('never exceeds 60 characters', () => {
    const title = fitTitle('A'.repeat(90), 'Acme', '$200k/yr')
    expect(title.length).toBeLessThanOrEqual(60)
    expect(title.endsWith('— $200k')).toBe(true)
  })

  it('works without a salary', () => {
    expect(fitTitle('Staff Engineer', 'Acme', null)).toBe('Staff Engineer at Acme | Six Figure Jobs')
  })
})

describe('capDescription', () => {
  it('leaves short descriptions alone', () => {
    expect(capDescription('Short and sweet.')).toBe('Short and sweet.')
  })

  it('cuts long descriptions at a word boundary within 160 characters', () => {
    const out = capDescription('word '.repeat(80))
    expect(out.length).toBeLessThanOrEqual(160)
    expect(out.endsWith('…')).toBe(true)
    expect(out).not.toMatch(/wor…$/)
  })
})
