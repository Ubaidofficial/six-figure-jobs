import { createHmac, timingSafeEqual, scryptSync, randomBytes } from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from '../prisma'

const COOKIE_NAME = 'admin_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 days

function getSecret(): string {
  const s = process.env.ADMIN_JWT_SECRET
  if (!s) throw new Error('ADMIN_JWT_SECRET env var is not set')
  return s
}

function sign(payload: string): string {
  return createHmac('sha256', getSecret()).update(payload).digest('hex')
}

export function createSessionToken(): string {
  const payload = `admin:${Date.now()}`
  const sig = sign(payload)
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function verifySessionToken(token: string): boolean {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const lastColon = decoded.lastIndexOf(':')
    const payload = decoded.slice(0, lastColon)
    const sig = decoded.slice(lastColon + 1)
    const expected = sign(payload)
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    const candidate = scryptSync(password, salt, 64).toString('hex')
    return timingSafeEqual(Buffer.from(candidate), Buffer.from(hash))
  } catch {
    return false
  }
}

export async function checkAdminCredentials(username: string, password: string): Promise<boolean> {
  const user = await prisma.adminUser.findUnique({ where: { username } })
  if (!user) return false
  return verifyPassword(password, user.passwordHash)
}

export async function adminUserExists(): Promise<boolean> {
  const count = await prisma.adminUser.count()
  return count > 0
}

export async function createAdminUser(username: string, password: string): Promise<void> {
  const passwordHash = hashPassword(password)
  await prisma.adminUser.create({ data: { username, passwordHash } })
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token) return false
  return verifySessionToken(token)
}

export function sessionCookieOptions(token: string) {
  return {
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  }
}

export function clearCookieOptions() {
  return {
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
    path: '/',
  }
}
