// Entitlement checks. Always answered from the database (the Stripe mirror and the ledger), never from the session
// cookie or anything the browser sends, so a client cannot claim a plan or a balance.

import type { PrismaClient } from '@prisma/client'

import { getBalance } from './credits'

import { prisma } from '@/lib/prisma'

/** Stripe statuses that carry access. past_due, unpaid, canceled, incomplete* and paused do not. */
export const ACTIVE_SUBSCRIPTION_STATUSES = ['active', 'trialing'] as const

/**
 * If the "subscription deleted" webhook is ever lost, access would otherwise never end. A renewal moves
 * currentPeriodEnd forward within moments of the period ending, so a period that ended more than this long ago means
 * the mirror is stale and access stops. Technical safety margin, not a product decision.
 */
export const STALE_PERIOD_GRACE_MS = 3 * 24 * 60 * 60 * 1000

/**
 * A failed renewal leaves the subscription "past_due" while Stripe retries the card (Smart Retries). A paying customer
 * should not lose access the moment one attempt fails, so a past_due subscription still counts for this long after it
 * went past_due (measured from the event that set the status). Stripe's own retry schedule ends the wait: when it gives up
 * the status changes again and access stops. Credits are never granted for an unpaid period; that happens only on invoice.paid.
 */
export const PAST_DUE_GRACE_MS = 3 * 24 * 60 * 60 * 1000

export async function hasActiveSubscription(
  userId: string,
  db: Pick<PrismaClient, 'subscription'> = prisma,
  now: Date = new Date(),
): Promise<boolean> {
  if (!userId) return false
  const rows = await db.subscription.findMany({
    where: { userId, status: { in: [...ACTIVE_SUBSCRIPTION_STATUSES, 'past_due'] } },
    select: { status: true, currentPeriodEnd: true, lastEventAt: true },
  })
  return rows.some((r) => {
    if (r.status === 'past_due') return !!r.lastEventAt && r.lastEventAt.getTime() + PAST_DUE_GRACE_MS > now.getTime()
    return !r.currentPeriodEnd || r.currentPeriodEnd.getTime() + STALE_PERIOD_GRACE_MS > now.getTime()
  })
}

export class EntitlementError extends Error {
  /** HTTP status a route should answer with: 401 not signed in, 402 payment needed. */
  readonly status: 401 | 402
  constructor(
    readonly code: 'unauthenticated' | 'subscription_required' | 'insufficient_credits',
    message: string,
  ) {
    super(message)
    this.name = 'EntitlementError'
    this.status = code === 'unauthenticated' ? 401 : 402
  }
}

export interface EntitlementRequirement {
  /** Require an active subscription. */
  subscription?: boolean
  /** Require at least this many credits (checked, not spent; use spendCredits to spend). */
  minCredits?: number
}

/**
 * Throws EntitlementError unless the user meets every requirement. A missing userId means "not signed in".
 * This is a check, not a reservation: to charge for something call spendCredits, which is the atomic step.
 */
export async function requireEntitlement(
  userId: string | null | undefined,
  requirement: EntitlementRequirement,
  db: Pick<PrismaClient, 'subscription' | 'creditLedger'> = prisma,
): Promise<void> {
  if (!userId) throw new EntitlementError('unauthenticated', 'Sign in required')
  if (requirement.subscription && !(await hasActiveSubscription(userId, db))) {
    throw new EntitlementError('subscription_required', 'An active subscription is required')
  }
  if (requirement.minCredits && requirement.minCredits > 0) {
    if ((await getBalance(userId, db)) < requirement.minCredits) {
      throw new EntitlementError('insufficient_credits', 'Not enough credits')
    }
  }
}
