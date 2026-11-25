/**
 * @jest-environment node
 */
// "Check employer" in the Review queue (lib/admin/employerCheck.ts): a hint that never expires anything, and a fetch of
// third-party links that must not reach private addresses.
import { checkEmployer, isPrivateAddress, publicHttpUrl, readEmployerPage, type PageResult } from '../../lib/admin/employerCheck'

const page = (status: number, text = '', finalUrl = 'https://boards.greenhouse.io/acme/jobs/123'): PageResult => ({ status, finalUrl, text })
const JOB = 'https://boards.greenhouse.io/acme/jobs/123'

describe('only public web addresses are fetched', () => {
  it('refuses private, loopback, link-local and odd schemes', () => {
    for (const u of [
      'http://127.0.0.1/', 'http://10.0.0.5/x', 'http://192.168.1.1', 'http://172.20.0.1', 'http://169.254.169.254/latest/meta-data',
      'http://[::1]/', 'http://localhost:3000', 'http://postgres.internal', 'file:///etc/passwd', 'ftp://example.com',
      'https://user:pass@example.com/', 'not a url', '',
    ])
      expect(publicHttpUrl(u)).toBeNull()
    expect(publicHttpUrl(JOB)?.host).toBe('boards.greenhouse.io')
  })
  it('knows private addresses, including IPv4 inside IPv6', () => {
    expect(isPrivateAddress('100.64.1.1')).toBe(true)
    expect(isPrivateAddress('::ffff:10.1.2.3')).toBe(true)
    expect(isPrivateAddress('fd12::1')).toBe(true)
    expect(isPrivateAddress('8.8.8.8')).toBe(false)
    expect(isPrivateAddress('2606:4700::1111')).toBe(false)
  })
})

describe('reading the employer page', () => {
  it('a 404 or 410 is closed', () => {
    expect(readEmployerPage(JOB, page(404)).verdict).toBe('closed')
    expect(readEmployerPage(JOB, page(410)).verdict).toBe('closed')
  })
  it('Greenhouse sends a closed job to the board with ?error=true', () => {
    expect(readEmployerPage(JOB, page(200, '<h1>Acme jobs</h1>', 'https://boards.greenhouse.io/acme?error=true')).verdict).toBe('closed')
  })
  it('a page that says the job closed, outside scripts', () => {
    const r = readEmployerPage(JOB, page(200, '<div>Sorry, this position has <b>been filled</b>.</div><p>This position has been filled</p>'))
    expect(r).toEqual({ verdict: 'closed', lines: ['The employer\'s page says “this position has been filled”.'] })
    expect(readEmployerPage(JOB, page(200, '<script>var t="job not found"</script><h1>Staff Engineer</h1>')).verdict).toBe('open')
  })
  it('a redirect to a shorter path or another site reads as closed', () => {
    expect(readEmployerPage(JOB, page(200, '<h1>Careers</h1>', 'https://boards.greenhouse.io/acme')).verdict).toBe('closed')
    expect(readEmployerPage(JOB, page(200, '<h1>Careers</h1>', 'https://acme.com/careers')).verdict).toBe('closed')
  })
  it('a page that loads is "looks open", with the JavaScript caveat; blocked or failed is unknown', () => {
    expect(readEmployerPage(JOB, page(200, '<h1>Staff Engineer</h1><button>Apply</button>')).lines[0]).toMatch(/JavaScript/)
    expect(readEmployerPage(JOB, page(403)).verdict).toBe('unknown')
    expect(readEmployerPage(JOB, { error: 'timed out' }).verdict).toBe('unknown')
  })
})

describe('checkEmployer', () => {
  it('freehire saying closed wins over a page that loads', async () => {
    const r = await checkEmployer(
      { applyUrl: JOB, url: null, freehireSlug: 'acme-staff' },
      { lookupFreehire: async () => ({ state: 'closed', closedAt: '2026-11-20T10:00:00Z' }), fetchPage: async () => page(200, '<h1>Staff</h1>') },
    )
    expect(r.verdict).toBe('closed')
    expect(r.lines[0]).toBe('freehire marks it closed (2026-11-20).')
  })
  it('never fetches a private address, even if a job stores one', async () => {
    const fetchPage = jest.fn(async () => page(200))
    const r = await checkEmployer({ applyUrl: 'http://169.254.169.254/latest', url: null, freehireSlug: null }, { fetchPage })
    expect(fetchPage).not.toHaveBeenCalled()
    expect(r.verdict).toBe('unknown')
  })
  it('says so when there is nothing to check', async () => {
    expect((await checkEmployer({ applyUrl: null, url: null, freehireSlug: null })).lines).toEqual([
      'No apply link stored, so there is no employer page to check.',
    ])
  })
})
