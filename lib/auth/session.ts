import { accountsEnabled } from '@/lib/accounts/enabled'
import { prisma } from '@/lib/prisma'

export interface SessionUser {
  id: string
  email: string | null
  name: string | null
}

/**
 * The signed-in user, or null. Null whenever accounts are disabled, there is no valid session cookie, or the user no
 * longer exists (JWT sessions cannot be revoked, so a deleted user must not stay signed in). Server-only: it reads the
 * cookie, which makes whatever calls it dynamic, so never call it from a public layout or page.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  if (!accountsEnabled()) return null
  const { auth } = await import('./index')
  const session = await auth()
  const id = session?.user?.id
  if (!id) return null
  return prisma.user.findUnique({ where: { id }, select: { id: true, email: true, name: true } })
}
