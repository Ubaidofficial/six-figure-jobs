import { dedupeLatest, isHomepageFeatured } from '../../lib/jobs/latestSelection'

let n = 0
const job = (countryCode: string, companyId: string, remote = false) =>
  ({ id: `j${++n}`, title: `Role ${n}`, companyId, countryCode, remote, minAnnual: 1, maxAnnual: 2 }) as never

describe('dedupeLatest', () => {
  it('keeps at most 3 jobs per market, newest first, when there is enough variety', () => {
    const jobs = [
      ...Array.from({ length: 8 }, (_, i) => job('CH', `ch${i}`)),
      job('US', 'u1'), job('US', 'u2'), job('GB', 'g1'), job('CA', 'c1'), job('DE', 'd1'),
      job('US', 'u3', true), job('US', 'u4'),
    ]
    const picked = dedupeLatest(jobs, 10) as Array<{ countryCode: string }>
    expect(picked).toHaveLength(10)
    expect(picked.filter((j) => j.countryCode === 'CH')).toHaveLength(3)
    expect(picked.map((j) => (jobs as Array<{ id: string }>).findIndex((x) => x === (j as unknown)))).toEqual(
      [...picked.map((j) => (jobs as Array<{ id: string }>).findIndex((x) => x === (j as unknown)))].sort((a, b) => a - b),
    )
  })

  it('still fills the list when the newest jobs are all one market', () => {
    const jobs = Array.from({ length: 12 }, (_, i) => job('CH', `c${i}`))
    expect(dedupeLatest(jobs, 10)).toHaveLength(10)
  })

  it('keeps the employer cap even when filling', () => {
    const jobs = Array.from({ length: 12 }, () => job('CH', 'same'))
    expect(dedupeLatest(jobs, 10)).toHaveLength(2)
  })

  it('counts a job without countryCode toward the country its location names', () => {
    // Live data, 2026-11-08: two had countryCode DE, one only "Cottbus, Brandenburg, Germany", one only "Hamburg, Hamburg"
    // with euro pay (the job page's JSON-LD says DE for both).
    const de = (i: number, countryCode: string | null, locationRaw: string, city: string) =>
      ({ id: `de${i}`, title: `Arzt ${i}`, companyId: `d${i}`, countryCode, locationRaw, city, currency: 'EUR', minAnnual: 1, maxAnnual: 2 }) as never
    const jobs = [
      de(1, 'DE', 'Krefeld, Nordrhein-Westfalen', 'Krefeld'),
      de(2, 'DE', 'Olpe, Nordrhein-Westfalen', 'Olpe'),
      de(3, null, 'Cottbus, Brandenburg, Germany', 'Cottbus'),
      de(4, null, 'Hamburg, Hamburg', 'Hamburg'),
      job('US', 'u9'), job('GB', 'g9'), job('CA', 'c9'),
    ]
    const picked = dedupeLatest(jobs, 6) as Array<{ id: string }>
    expect(picked.filter((j) => j.id.startsWith('de'))).toHaveLength(3)
  })

  it('lists English jobs with a real role first, still newest first, and fills with the rest', () => {
    // Live 2026-11-08: German agency ads (role "other", "(m/w/d)") were the newest jobs and topped the homepage.
    const at = (h: number) => new Date(Date.UTC(2026, 10, 8, h)).toISOString()
    const de = (i: number) => ({ id: `de${i}`, title: `Facharzt (m/w/d) ${i}`, companyId: `d${i}`, countryCode: 'DE', roleSlug: 'other', postedAt: at(20 - i), minAnnual: 1, maxAnnual: 2 }) as never
    const en = (i: number, cc: string) => ({ id: `en${i}`, title: `Data Engineer ${i}`, companyId: `e${i}`, countryCode: cc, roleSlug: 'data-engineer', postedAt: at(10 - i), minAnnual: 1, maxAnnual: 2 }) as never
    const jobs = [de(1), de(2), en(1, 'US'), en(2, 'GB'), en(3, 'CA')]
    const picked = (dedupeLatest(jobs, 4) as Array<{ id: string }>).map((j) => j.id)
    expect(picked).toEqual(['de1', 'en1', 'en2', 'en3'])
  })

  it('features a job only with a real role and no German gender tag in the title', () => {
    expect(isHomepageFeatured({ title: 'Senior Data Engineer', roleSlug: 'senior-data-engineer' })).toBe(true)
    expect(isHomepageFeatured({ title: 'Global Product Manager (m/f/d)', roleSlug: 'product-manager' })).toBe(true)
    expect(isHomepageFeatured({ title: 'DevOps Engineer CI/CD (m/w/d)', roleSlug: 'devops-engineer' })).toBe(false)
    expect(isHomepageFeatured({ title: 'Controller (w/m/d)', roleSlug: 'controller' })).toBe(false)
    expect(isHomepageFeatured({ title: 'Facharzt', roleSlug: 'other' })).toBe(false)
  })
})
