jest.mock('@/lib/prisma', () => ({ prisma: {} }))

import { alertsEnabled, DUE_AFTER_MS, MAX_JOBS_PER_COMPANY } from '@/lib/alerts/config'
import { alertFiltersKey, buildAlertLabel, sanitizeAlertFilters } from '@/lib/alerts/filters'
import { buildConfirmationEmail, buildDigestEmail, isDue, newJobsSince, pickDigestJobs, type DigestJob } from '@/lib/alerts/digest'
import { isToken, normalizeEmail, searchUrlFor } from '@/lib/alerts/service'

const links = {
  manage: 'https://www.6figjobs.com/alerts/' + 'a'.repeat(64),
  unsubscribe: 'https://www.6figjobs.com/api/alerts/' + 'a'.repeat(64),
  search: 'https://www.6figjobs.com/jobs?sort=recent',
}
const now = new Date('2026-11-10T08:43:00Z')
const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600_000)

describe('alerts switch', () => {
  const full = { ALERTS_ENABLED: 'true', EMAIL_SERVER: 'smtp://x', EMAIL_FROM: 'a@b.c', ALERTS_POSTAL_ADDRESS: '1 Main St' }
  it('is on only with every setting a lawful email needs', () => {
    expect(alertsEnabled(full)).toBe(true)
    expect(alertsEnabled({ ...full, ALERTS_ENABLED: 'false' })).toBe(false)
    expect(alertsEnabled({ ...full, ALERTS_POSTAL_ADDRESS: '' })).toBe(false)
    expect(alertsEnabled({ ...full, EMAIL_SERVER: undefined })).toBe(false)
  })
})

describe('alert filters', () => {
  it('keeps the listing query fields and drops everything else', () => {
    const f = sanitizeAlertFilters({
      page: 3,
      pageSize: 20,
      sortBy: 'salary',
      roleSlugs: ['software-engineer', 'software-engineer', 'BAD SLUG'],
      countryCode: 'DE',
      remoteMode: 'remote',
      remoteRegion: 'europe',
      seniorityLevels: ['senior'],
      minAnnual: 150000,
      currency: 'EUR',
      keywordPlan: { terms: [] },
      noDegreeRequired: { ids: [1] },
    })
    expect(f).toEqual({
      roleSlugs: ['software-engineer'],
      countryCode: 'DE',
      remoteMode: 'remote',
      remoteRegion: 'europe',
      seniorityLevels: ['senior'],
      minAnnual: 150000,
      currency: 'EUR',
    })
  })

  it('rejects bad values', () => {
    expect(sanitizeAlertFilters(null)).toBeNull()
    expect(sanitizeAlertFilters([1])).toBeNull()
    expect(sanitizeAlertFilters({ countryCode: 'Germany', remoteMode: 'mars', remoteRegion: 'moon', minAnnual: -5 })).toEqual({})
    expect(sanitizeAlertFilters({ minAnnual: 200000, maxAnnual: 100000, currency: 'USD' })).toEqual({ minAnnual: 200000, currency: 'USD' })
    expect(sanitizeAlertFilters({ currency: 'USD' })).toEqual({})
  })

  it('keeps plain keywords and refuses links or addresses in them', () => {
    expect(sanitizeAlertFilters({ keyword: '  Senior   C++ Developer ' })).toEqual({ keyword: 'senior c++ developer' })
    expect(sanitizeAlertFilters({ keyword: 'node.js' })).toEqual({ keyword: 'node.js' })
    expect(sanitizeAlertFilters({ keyword: 'win money at cheap.ru' })).toEqual({})
    expect(sanitizeAlertFilters({ keyword: 'visit https://spam' })).toEqual({})
    expect(sanitizeAlertFilters({ keyword: 'mail me@x.co' })).toEqual({})
    expect(sanitizeAlertFilters({ keyword: '<script>' })).toEqual({})
    expect(sanitizeAlertFilters({ keyword: 'x'.repeat(61) })).toEqual({})
  })

  it('gives the same key for the same search in any order', () => {
    const a = sanitizeAlertFilters({ countryCode: 'US', roleSlugs: ['b-role', 'a-role'] })!
    const b = sanitizeAlertFilters({ roleSlugs: ['a-role', 'b-role'], countryCode: 'US' })!
    expect(alertFiltersKey(a)).toBe(alertFiltersKey(b))
    expect(alertFiltersKey(a)).not.toBe(alertFiltersKey({ ...a, countryCode: 'CA' }))
  })

  it('names the alert from the filters', () => {
    expect(buildAlertLabel({})).toBe('Six-figure jobs')
    expect(buildAlertLabel({ roleSlugs: ['software-engineer'], seniorityLevels: ['senior'], remoteRegion: 'europe' })).toBe(
      'Senior Software Engineer jobs · Remote (Europe)',
    )
    expect(buildAlertLabel({ keyword: 'rust', countryCode: 'US', minAnnual: 150000, currency: 'USD' })).toBe(
      '“rust” jobs · USA · $150k+',
    )
    expect(buildAlertLabel({ remoteOnly: true, visaSponsorship: true })).toBe('Six-figure jobs · Remote · Visa sponsorship')
  })
})

describe('when a digest is due and what is new', () => {
  it('is due on the first run, then after (about) a day or a week', () => {
    expect(isDue({ frequency: 'daily', lastSentAt: null }, now)).toBe(true)
    expect(isDue({ frequency: 'daily', lastSentAt: hoursAgo(23.5) }, now)).toBe(true)
    expect(isDue({ frequency: 'daily', lastSentAt: hoursAgo(5) }, now)).toBe(false)
    expect(isDue({ frequency: 'weekly', lastSentAt: hoursAgo(24 * 6) }, now)).toBe(false)
    expect(isDue({ frequency: 'weekly', lastSentAt: new Date(now.getTime() - DUE_AFTER_MS.weekly) }, now)).toBe(true)
  })

  it('takes jobs since the last email or confirmation, never more than the lookback', () => {
    expect(newJobsSince({ frequency: 'daily', lastSentAt: hoursAgo(24), confirmedAt: hoursAgo(300) }, now)).toEqual(hoursAgo(24))
    expect(newJobsSince({ frequency: 'daily', lastSentAt: null, confirmedAt: hoursAgo(3) }, now)).toEqual(hoursAgo(3))
    expect(newJobsSince({ frequency: 'daily', lastSentAt: hoursAgo(24 * 30), confirmedAt: null }, now)).toEqual(hoursAgo(48))
    expect(newJobsSince({ frequency: 'weekly', lastSentAt: null, confirmedAt: null }, now)).toEqual(hoursAgo(24 * 8))
  })
})

describe('picking the jobs for one email', () => {
  const job = (title: string, company: string) => ({ title, company })
  it('drops the same job from another board and caps each company', () => {
    const picked = pickDigestJobs(
      [
        job('Staff Engineer', 'Acme'),
        job('Staff Engineer (Remote)', 'ACME'),
        job('Senior Engineer', 'Acme'),
        job('Principal Engineer', 'Acme'),
        job('Data Engineer', 'Globex'),
      ],
      10,
    )
    expect(picked.map((j) => `${j.title}@${j.company}`)).toEqual(['Staff Engineer@Acme', 'Senior Engineer@Acme', 'Data Engineer@Globex'])
    expect(MAX_JOBS_PER_COMPANY).toBe(2)
  })

  it('stops at the limit', () => {
    expect(pickDigestJobs([job('A', '1'), job('B', '2'), job('C', '3')], 2)).toHaveLength(2)
  })
})

describe('emails', () => {
  const jobs: DigestJob[] = [
    { id: '1', title: 'Staff <b>Engineer</b>', company: 'Acme & Co', salary: '$200K - $250K', location: 'Remote · US', url: 'https://www.6figjobs.com/job/a?x=1&y=2' },
    { id: '2', title: 'Data Engineer', company: 'Globex', salary: null, location: null, url: 'https://www.6figjobs.com/job/b' },
  ]

  it('escapes employer text and carries the one-click unsubscribe headers', () => {
    const mail = buildDigestEmail({ label: 'Software Engineer jobs · Remote', frequency: 'weekly', jobs, totalNew: 5, links, postalAddress: '1 Main St, Springfield' })
    expect(mail.subject).toBe('2 new Software Engineer jobs · Remote')
    expect(mail.html).toContain('Staff &lt;b&gt;Engineer&lt;/b&gt;')
    expect(mail.html).not.toContain('<b>Engineer</b>')
    expect(mail.html).toContain('Acme &amp; Co')
    expect(mail.html).toContain('https://www.6figjobs.com/job/a?x=1&amp;y=2')
    expect(mail.html).toContain('See 3 more')
    expect(mail.html).toContain('1 Main St, Springfield')
    expect(mail.text).toContain('Change frequency or unsubscribe: ' + links.manage)
    expect(mail.headers).toEqual({ 'List-Unsubscribe': `<${links.unsubscribe}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' })
  })

  it('says "job" for one job and keeps the subject on one line', () => {
    const mail = buildDigestEmail({ label: 'Rust jobs\r\nBcc: x@y.z', frequency: 'daily', jobs: [jobs[1]], totalNew: 1, links, postalAddress: 'A' })
    expect(mail.subject).toBe('1 new Rust job Bcc: x@y.z')
    expect(mail.subject).not.toMatch(/[\r\n]/)
  })

  it('confirmation email links to the alert page and nothing else', () => {
    const mail = buildConfirmationEmail({ label: 'Six-figure jobs', frequency: 'daily', links, postalAddress: '1 Main St' })
    expect(mail.subject).toBe('Confirm your job alert: Six-figure jobs')
    expect(mail.html).toContain(links.manage)
    expect(mail.html.match(/href=/g)).toHaveLength(1)
  })
})

describe('service helpers', () => {
  it('normalises email addresses', () => {
    expect(normalizeEmail('  Me@Example.COM ')).toBe('me@example.com')
    expect(normalizeEmail('not-an-email')).toBeNull()
    expect(normalizeEmail('a@b')).toBeNull()
    expect(normalizeEmail('a b@c.com')).toBeNull()
    expect(normalizeEmail(`${'a'.repeat(250)}@b.com`)).toBeNull()
  })

  it('accepts only 64-hex tokens', () => {
    expect(isToken('a'.repeat(64))).toBe(true)
    expect(isToken('A'.repeat(64))).toBe(false)
    expect(isToken('../etc')).toBe(false)
  })

  it('links to the same search on /jobs, newest first', () => {
    const url = new URL(searchUrlFor({ roleSlugs: ['data-engineer'], remoteOnly: true, countryCode: 'US', minAnnual: 150000 }, 'https://www.6figjobs.com'))
    expect(url.pathname).toBe('/jobs')
    expect(url.searchParams.getAll('role')).toEqual(['data-engineer'])
    expect(url.searchParams.get('remoteMode')).toBe('remote')
    expect(url.searchParams.get('country')).toBe('US')
    expect(url.searchParams.get('minSalary')).toBe('150000')
    expect(url.searchParams.get('sort')).toBe('recent')
    expect(url.searchParams.get('utm_source')).toBe('job_alert')
  })
})
