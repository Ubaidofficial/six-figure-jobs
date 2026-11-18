import { buildDigestEmail } from '@/lib/alerts/digest'
import { cleanAlertKeyword } from '@/lib/alerts/keyword'
import { sanitizeAlertFilters, buildAlertLabel } from '@/lib/alerts/filters'

jest.mock('@/lib/roles/relatedRoles', () => ({ roleLabelFor: (s: string) => s }))

const links = { manage: 'https://x.test/alerts/t', unsubscribe: 'https://x.test/api/alerts/t', search: 'https://x.test/jobs' }
const job = (over: object) => ({ id: '1', title: 'Data Engineer', company: 'Acme Labs', salary: '$150k–$180k', location: 'Remote', url: 'https://x.test/job/1', ...over })

describe('digest layout', () => {
  it('shows the logo on a tile, the pay as a pill and a link per job', () => {
    const mail = buildDigestEmail({ label: 'Data Engineer jobs', frequency: 'daily', jobs: [job({ logo: 'https://x.test/logo/domain/acme.com' })], totalNew: 1, links, postalAddress: 'A' })
    expect(mail.html).toContain('<img src="https://x.test/logo/domain/acme.com"')
    expect(mail.html).toContain('$150k–$180k</span>')
    expect(mail.html).toContain('View job &rarr;')
    // Inbox preview: the best-paid job.
    expect(mail.html).toContain('Data Engineer at Acme Labs, $150k–$180k')
  })

  it('falls back to initials for a missing or non-HTTPS logo, and escapes the logo URL', () => {
    const none = buildDigestEmail({ label: 'L', frequency: 'daily', jobs: [job({ logo: null })], totalNew: 1, links, postalAddress: 'A' })
    expect(none.html).not.toContain('<img')
    expect(none.html).toContain('>AL</div>')
    const http = buildDigestEmail({ label: 'L', frequency: 'daily', jobs: [job({ logo: 'http://x.test/a.png' })], totalNew: 1, links, postalAddress: 'A' })
    expect(http.html).not.toContain('<img')
    const odd = buildDigestEmail({ label: 'L', frequency: 'daily', jobs: [job({ logo: 'https://x.test/a.png"onerror="x' })], totalNew: 1, links, postalAddress: 'A' })
    expect(odd.html).not.toContain('"onerror="')
  })

  it('omits the pill when a job has no pay', () => {
    const mail = buildDigestEmail({ label: 'L', frequency: 'daily', jobs: [job({ salary: null })], totalNew: 1, links, postalAddress: 'A' })
    expect(mail.html).not.toContain('#ecfccb')
  })
})

describe('role typed in the signup form', () => {
  it('keeps roles and skills, refuses links and addresses', () => {
    expect(cleanAlertKeyword('  Product   Manager ')).toBe('product manager')
    expect(cleanAlertKeyword('C++')).toBe('c++')
    expect(cleanAlertKeyword('visit spam.com')).toBeNull()
    expect(cleanAlertKeyword('me@x.io')).toBeNull()
    expect(cleanAlertKeyword('<b>')).toBeNull()
  })

  it('becomes a remote keyword alert with a readable name', () => {
    const f = sanitizeAlertFilters({ keyword: 'Product manager', remoteMode: 'remote' })
    expect(f).toEqual({ keyword: 'product manager', remoteMode: 'remote' })
    expect(buildAlertLabel(f!)).toBe('Product Manager jobs · Remote')
  })
})
