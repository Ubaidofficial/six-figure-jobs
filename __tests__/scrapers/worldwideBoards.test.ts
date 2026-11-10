jest.mock('../../lib/prisma', () => ({ prisma: {} }))

import {
  mapHimalayasJob,
  mapWwrItem,
  salaryFromText,
  workplaceLimit,
  worldwideLocationText,
} from '../../lib/scrapers/worldwideBoards'

describe('where a "work from anywhere" job can really be done', () => {
  it("reads We Work Remotely's location line, whatever the board's label says (seen 2026-11-10)", () => {
    expect(workplaceLimit('<p><strong>Headquarters:</strong> Remote - USA</p><p>About us</p>')).toBe('US')
    expect(workplaceLimit('<p>Headquarters: San Francisco, CA or Remote, US</p>')).toBe('US')
    expect(workplaceLimit('<p>Headquarters: US Remote</p>')).toBe('US')
    expect(workplaceLimit('<p>Headquarters: Remote - Canada</p>')).toBe('other')
    expect(workplaceLimit('<p>Headquarters: San Franciscio Bay Area Remote</p>')).toBe('other')
    expect(workplaceLimit('<p>Headquarters: Remote - California; Remote - Colorado; Remote - Illinois; Remote - New York</p>')).toBe('other')
    expect(workplaceLimit('<p>Headquarters: Remote</p><p>We hire everywhere.</p>')).toBeNull()
  })

  it('reads limits written in the text, and a region in the title', () => {
    expect(workplaceLimit('At this time, we are only considering candidates located in and authorized to work in the United States.')).toBe('US')
    expect(workplaceLimit('The role is based in San Francisco, with remote applicants in the US considered.')).toBe('US')
    expect(workplaceLimit('You must overlap with EST business hours.')).toBe('other')
    expect(workplaceLimit('Fully distributed team.', 'Enterprise Account Executive - California')).toBe('other')
    expect(workplaceLimit('Fully distributed team.', 'Salesforce Lead - USA')).toBe('US')
    expect(workplaceLimit('Fully distributed team.', 'Senior Backend Engineer')).toBeNull()
  })

  it('writes location text our parser and the worldwide filter read', () => {
    expect(worldwideLocationText('Headquarters: Remote')).toBe('Remote - Worldwide')
    expect(worldwideLocationText('Headquarters: Remote - USA')).toBe('Remote - United States')
    expect(worldwideLocationText('Headquarters: Remote - Canada')).toBe('Remote')
  })
})

describe('salary from posting text', () => {
  it('reads a yearly range and ignores bonuses and small figures', () => {
    expect(salaryFromText('The base salary range is $180,000 - $220,000 per year.')).toEqual({ min: 180000, max: 220000 })
    expect(salaryFromText('Pay: $150k–$190k')).toEqual({ min: 150000, max: 190000 })
    expect(salaryFromText('A $500 bonus for new parents.')).toBeNull()
    expect(salaryFromText('No salary given.')).toBeNull()
  })
})

const wwrItem = (region: string, description: string) =>
  `<title>Acme: Staff Engineer</title><region>${region}</region><link>https://weworkremotely.com/remote-jobs/acme-staff-engineer</link>` +
  `<pubDate>Mon, 09 Nov 2026 17:43:52 +0000</pubDate><description><![CDATA[${description}]]></description>`

describe('We Work Remotely feed items', () => {
  it('maps an "Anywhere in the World" item, applying on the board', () => {
    const job = mapWwrItem(wwrItem('Anywhere in the World', '<p>Headquarters: Remote</p><p>Salary: $180,000 - $220,000</p>'))!
    expect(job.rawCompanyName).toBe('Acme')
    expect(job.title).toBe('Staff Engineer')
    expect(job.applyUrl).toBe('https://weworkremotely.com/remote-jobs/acme-staff-engineer')
    expect(job.salaryMin).toBe(180000)
    expect(job.salaryCurrency).toBe('USD')
    expect(job.locationText).toBe('Remote - Worldwide')
    expect(job.postedAt?.toISOString()).toBe('2026-11-09T17:43:52.000Z')
  })

  it('skips items not labelled "Anywhere in the World", and keeps US-only ones as US remote jobs', () => {
    expect(mapWwrItem(wwrItem('USA Only', '<p>x</p>'))).toBeNull()
    expect(mapWwrItem(wwrItem('Anywhere in the World', '<p>Headquarters: Remote - USA</p>'))!.locationText).toBe('Remote - United States')
  })
})

describe('Himalayas worldwide jobs', () => {
  const job = {
    guid: 'https://himalayas.app/companies/goflex/jobs/senior-engineering-manager',
    title: 'Senior Engineering Manager',
    companyName: 'Flex',
    applicationLink: 'https://himalayas.app/companies/goflex/jobs/senior-engineering-manager',
    description: '<p>Build things.</p>',
    locationRestrictions: [],
    minSalary: 200000,
    maxSalary: 300000,
    currency: 'USD',
    salaryPeriod: 'annual',
    pubDate: 1794099679,
  }

  it('maps an unrestricted job with yearly pay', () => {
    const m = mapHimalayasJob(job)!
    expect(m.salaryMax).toBe(300000)
    expect(m.locationText).toBe('Remote - Worldwide')
    expect(m.applyUrl).toBe(job.applicationLink)
  })

  it('passes no pay unless it is yearly, and skips restricted jobs', () => {
    expect(mapHimalayasJob({ ...job, salaryPeriod: 'hourly' })!.salaryMax).toBeNull()
    expect(mapHimalayasJob({ ...job, locationRestrictions: ['United States'] })).toBeNull()
  })
})
