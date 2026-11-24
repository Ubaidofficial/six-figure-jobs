/**
 * @jest-environment node
 */
// Admin pages behind the proxy: a cookie must carry a valid signature naming an account, not merely exist. Next can skip
// the dashboard layout's own session check on client-router requests, so a forged cookie used to reach page content.
jest.mock('../../lib/jobs/jobAvailabilityCheck', () => ({ checkJobAvailability: jest.fn(async () => null) }))

import { NextRequest } from 'next/server'

import { createSessionToken } from '../../lib/admin/session'
import { proxy } from '../../proxy'

const HOST = 'www.sixfigurejobs.net'
const get = (path: string, cookie?: string) =>
  proxy(
    new NextRequest(`https://${HOST}${path}`, {
      headers: { host: HOST, 'user-agent': 'Mozilla/5.0 Chrome/131.0', ...(cookie ? { cookie: `admin_session=${cookie}` } : {}) },
    }),
  )
const toLogin = (res: Response) => res.status >= 300 && res.status < 400 && /\/ubaid93\/login$/.test(res.headers.get('location') ?? '')

describe('admin proxy guard', () => {
  beforeAll(() => {
    process.env.SITE_URL = `https://${HOST}`
  })

  it('sends a request with no cookie, a forged cookie or an old account-less token to the login page', async () => {
    expect(toLogin(await get('/ubaid93/alerts'))).toBe(true)
    expect(toLogin(await get('/ubaid93/alerts', 'x'))).toBe(true)
    expect(toLogin(await get('/ubaid93/alerts', createSessionToken()))).toBe(true)
  })

  it('lets a signed session for an account through (the page then checks the account itself)', async () => {
    const res = await get('/ubaid93/alerts', createSessionToken({ id: 'u1', fingerprint: 'abc' }))
    expect(toLogin(res)).toBe(false)
  })

  it('leaves the login and setup pages open', async () => {
    expect(toLogin(await get('/ubaid93/login'))).toBe(false)
    expect(toLogin(await get('/ubaid93/setup'))).toBe(false)
  })
})
