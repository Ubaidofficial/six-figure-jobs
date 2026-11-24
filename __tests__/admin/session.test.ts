/**
 * @jest-environment node
 */
// Admin sessions name their account and its password fingerprint; setup needs ADMIN_SETUP_TOKEN.
let cookie: string | undefined
jest.mock('next/headers', () => ({ cookies: async () => ({ get: () => (cookie ? { value: cookie } : undefined) }) }))
const users = new Map<string, { id: string; username: string; passwordHash: string }>()
jest.mock('../../lib/prisma', () => ({
  prisma: {
    adminUser: {
      findUnique: async ({ where }: { where: { id?: string; username?: string } }) =>
        [...users.values()].find((u) => (where.id ? u.id === where.id : u.username === where.username)) ?? null,
      count: async () => users.size,
      create: async ({ data }: { data: { username: string; passwordHash: string } }) => {
        const u = { id: `u${users.size + 1}`, ...data }
        users.set(u.id, u)
        return u
      },
    },
  },
}))

import { checkAdminCredentials, createSessionToken, getAdminSession, hashPassword, sessionTokenFor } from '../../lib/admin/auth'

beforeEach(() => {
  users.clear()
  users.set('u1', { id: 'u1', username: 'ubaid', passwordHash: hashPassword('correct horse') })
  cookie = undefined
  delete process.env.ADMIN_SETUP_TOKEN
})

describe('admin sessions', () => {
  it('accepts a token made for the account', async () => {
    cookie = sessionTokenFor(users.get('u1')!)
    expect(await getAdminSession()).toBe(true)
  })
  it('refuses the old token that named no account', async () => {
    cookie = createSessionToken()
    expect(await getAdminSession()).toBe(false)
  })
  it('ends sessions made before a password change', async () => {
    cookie = sessionTokenFor(users.get('u1')!)
    users.get('u1')!.passwordHash = hashPassword('new password')
    expect(await getAdminSession()).toBe(false)
  })
  it('signs in whatever the case of the username', async () => {
    expect(await checkAdminCredentials('Ubaid', 'correct horse')).not.toBeNull()
    expect(await checkAdminCredentials('ubaid', 'wrong')).toBeNull()
  })
})

describe('first-admin setup', () => {
  const post = (body: unknown) =>
    new Request('https://x.test/api/ubaid93/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
  it('is off without ADMIN_SETUP_TOKEN, even with no account', async () => {
    users.clear()
    const { POST } = await import('../../app/api/ubaid93/setup/route')
    expect((await POST(post({ username: 'x', password: '12345678' }))).status).toBe(403)
    expect(users.size).toBe(0)
  })
  it('needs the right token', async () => {
    users.clear()
    process.env.ADMIN_SETUP_TOKEN = 'let-me-in-123'
    const { POST } = await import('../../app/api/ubaid93/setup/route')
    expect((await POST(post({ username: 'x', password: '12345678', token: 'guess' }))).status).toBe(403)
    expect((await POST(post({ username: 'Owner', password: '12345678', token: 'let-me-in-123' }))).status).toBe(200)
    expect([...users.values()][0].username).toBe('owner')
  })
})
