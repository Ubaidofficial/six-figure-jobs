// Node.js-only auth helpers — NOT Edge-safe (uses Prisma + next/headers)
// For Edge-safe token functions, see ./session.ts
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from '../prisma'
import {
  COOKIE_NAME,
  createSessionToken,
  verifySessionToken,
  sessionCookieOptions,
  clearCookieOptions,
} from './session'

// Re-export session token helpers so callers can import from one place
export { createSessionToken, verifySessionToken, sessionCookieOptions, clearCookieOptions }

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
