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
    expect(mail.html).not.toContain('class="x-pill"')
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

describe('digest in light and dark mode', () => {
  const now = Date.parse('2026-11-19T12:00:00Z')
  const mail = buildDigestEmail({
    label: 'Data Engineer jobs', frequency: 'daily', totalNew: 1, links, postalAddress: 'A', now,
    jobs: [job({ remote: true, listedAt: '2026-11-17T09:00:00Z', logo: 'https://x.test/l.png' })],
  })

  it('declares both colour schemes and carries dark styles for clients that honour them', () => {
    expect(mail.html).toContain('<meta name="color-scheme" content="light dark">')
    expect(mail.html).toContain('@media (prefers-color-scheme:dark)')
    expect(mail.html).toContain('[data-ogsc] .x-ink') // Outlook.com
    // The brand is text, not an image that a dark inbox could hide.
    expect(mail.html).toMatch(/class="x-ink"[^>]*>six figure jobs</)
    // Logos keep a white tile Gmail does not invert.
    expect(mail.html).toContain('background-image:linear-gradient(#ffffff,#ffffff)')
  })

  it('shows Remote and how long ago we listed the job, in HTML and text', () => {
    expect(mail.html).toContain('>Remote</span>')
    expect(mail.html).toContain('>2d ago</span>')
    expect(mail.text).toContain('Remote · 2d ago')
  })
})

describe('digest hero', () => {
  it('shows top pay, how many are remote and the total, and features the best-paid job', async () => {
    const { topOfRange } = await import('@/lib/alerts/digest')
    expect(topOfRange('$230K – $290K')).toBe('$290K')
    expect(topOfRange('£110K')).toBe('£110K')
    expect(topOfRange(null)).toBeNull()
    const mail = buildDigestEmail({
      label: 'L', frequency: 'daily', totalNew: 9, links, postalAddress: 'A',
      jobs: [job({ salary: '$230K – $290K', remote: true }), job({ id: '2', salary: '$150K', remote: false })],
    })
    expect(mail.html).toContain('>$290K</div>')
    expect(mail.html).toContain('>Top pay</div>')
    expect(mail.html).toContain('>New in total</div>')
    expect(mail.html.match(/>Top paid</g)).toHaveLength(1)
  })
})
