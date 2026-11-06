import type { PrismaClient } from '@prisma/client'

import { getBalance } from './credits'
import { hasActiveSubscription } from './entitlement'

import { prisma } from '@/lib/prisma'

export interface AccountSummary {
  balance: number
  subscription: { active: boolean; currentPeriodEnd: Date | null; cancelAtPeriodEnd: boolean }
  hasBillingAccount: boolean
}

/** Everything /account shows, read from the database (the ledger and the Stripe mirror). */
export async function loadAccountSummary(
  userId: string,
  db: Pick<PrismaClient, 'creditLedger' | 'subscription' | 'user'> = prisma,
): Promise<AccountSummary> {
  const [balance, active, latest, user] = await Promise.all([
    getBalance(userId, db),
    hasActiveSubscription(userId, db),
    db.subscription.findFirst({
      where: { userId, status: { in: ['active', 'trialing'] } },
      orderBy: { currentPeriodEnd: 'desc' },
      select: { currentPeriodEnd: true, cancelAtPeriodEnd: true },
    }),
    db.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } }),
  ])
  return {
    balance,
    subscription: {
      active,
      currentPeriodEnd: active ? (latest?.currentPeriodEnd ?? null) : null,
      cancelAtPeriodEnd: active ? (latest?.cancelAtPeriodEnd ?? false) : false,
    },
    hasBillingAccount: Boolean(user?.stripeCustomerId),
  }
}
