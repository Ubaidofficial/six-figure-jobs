// Node.js-only auth helpers — NOT Edge-safe (uses Prisma + next/headers)
// For Edge-safe token functions, see ./session.ts
import { scryptSync, randomBytes, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { prisma } from '../prisma'
import { createHash } from 'crypto'

import { COOKIE_NAME, createSessionToken, sessionAccount, verifySessionToken } from './session'

// Re-export session token helpers so callers can import from one place
export { createSessionToken, verifySessionToken }

/** Changes whenever the password changes; never the hash itself. */
export function passwordFingerprint(passwordHash: string): string {
  return createHash('sha256').update(`admin-pw:${passwordHash}`).digest('hex').slice(0, 16)
}

/** A session token for this account. */
export function sessionTokenFor(user: { id: string; passwordHash: string }): string {
  return createSessionToken({ id: user.id, fingerprint: passwordFingerprint(user.passwordHash) })
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

/** The account when the username (any case; setup stores it lowercased) and password match, else null. */
export async function checkAdminCredentials(username: string, password: string) {
  const user = await prisma.adminUser.findUnique({ where: { username: username.trim().toLowerCase() } })
  if (!user || !verifyPassword(password, user.passwordHash)) return null
  return user
}

export async function adminUserExists(): Promise<boolean> {
  const count = await prisma.adminUser.count()
  return count > 0
}

export async function createAdminUser(username: string, password: string) {
  const passwordHash = hashPassword(password)
  return prisma.adminUser.create({ data: { username, passwordHash } })
}

export async function getAdminSession(): Promise<boolean> {
  const cookieStore = await cookies()
  const token = cookieStore.get(COOKIE_NAME)?.value
  if (!token || !verifySessionToken(token)) return false
  const account = sessionAccount(token)
  if (!account) return false
  const user = await prisma.adminUser.findUnique({ where: { id: account.id }, select: { passwordHash: true } })
  return Boolean(user) && passwordFingerprint(user!.passwordHash) === account.fingerprint
}
