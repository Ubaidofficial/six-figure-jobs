// Credit ledger. Append-only: rows are inserted, never updated or deleted. Balance = SUM(delta).
//
// Concurrency: every operation that can lower a balance (spend, clawback) first takes a row lock on the user
// (SELECT ... FOR UPDATE) inside one transaction, then reads the balance and inserts. Two concurrent spends for the same
// user are therefore serialised and the second one sees the first one's row, so the balance can never go below zero.
// Grants only add credits, so they take no lock; their uniqueness comes from the idempotency key.

import type { Prisma, PrismaClient } from '@prisma/client'

import { MAX_CREDITS_PER_GRANT } from './config'

import { prisma } from '@/lib/prisma'

export type LedgerKind = 'subscription_grant' | 'pack' | 'spend' | 'refund'

export class CreditsError extends Error {
  constructor(
    readonly code: 'invalid_input' | 'user_not_found' | 'idempotency_conflict',
    message: string,
  ) {
    super(message)
    this.name = 'CreditsError'
  }
}

export type SpendResult =
  | { ok: true; balance: number; replayed: boolean }
  | { ok: false; reason: 'insufficient_credits'; balance: number }

const KEY_PATTERN = /^[A-Za-z0-9_.:@/=-]{1,200}$/
const REASON_PATTERN = /^[A-Za-z0-9_.:-]{1,64}$/

type Tx = Prisma.TransactionClient

async function balanceIn(tx: Pick<Tx, 'creditLedger'>, userId: string): Promise<number> {
  const agg = await tx.creditLedger.aggregate({ where: { userId }, _sum: { delta: true } })
  return agg._sum.delta ?? 0
}

/** Row-lock the user for the rest of the transaction. Throws if there is no such user. */
async function lockUser(tx: Tx, userId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
  if (rows.length === 0) throw new CreditsError('user_not_found', 'No such user')
}

export async function getBalance(userId: string, db: Pick<PrismaClient, 'creditLedger'> = prisma): Promise<number> {
  return balanceIn(db, userId)
}

/**
 * Spend `amount` credits. Atomic: either the whole amount is deducted or nothing is (insufficient_credits).
 * `kind` says what the credits were spent on (stored as the ledger reason). Safe to retry with the same
 * `idempotencyKey`: a replay returns the original outcome and deducts nothing. Make the key unique per user action,
 * for example `resume-review:${userId}:${documentId}`.
 */
export async function spendCredits(
  userId: string,
  kind: string,
  amount: number,
  idempotencyKey: string,
  db: Pick<PrismaClient, '$transaction'> = prisma,
): Promise<SpendResult> {
  if (!userId) throw new CreditsError('invalid_input', 'userId is required')
  if (!Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_CREDITS_PER_GRANT) {
    throw new CreditsError('invalid_input', 'amount must be a positive whole number')
  }
  if (!REASON_PATTERN.test(kind)) throw new CreditsError('invalid_input', 'kind is malformed')
  if (!KEY_PATTERN.test(idempotencyKey)) throw new CreditsError('invalid_input', 'idempotencyKey is malformed')

  return db.$transaction(async (tx) => {
    await lockUser(tx, userId)

    const existing = await tx.creditLedger.findUnique({ where: { idempotencyKey } })
    if (existing) {
      // The same key must mean the same spend. Anything else is a caller bug (or an attempt to reuse another's key).
      if (existing.userId !== userId || existing.kind !== 'spend' || existing.delta !== -amount) {
        throw new CreditsError('idempotency_conflict', 'idempotencyKey was already used for a different operation')
      }
      return { ok: true, balance: await balanceIn(tx, userId), replayed: true } as const
    }

    const balance = await balanceIn(tx, userId)
    if (balance < amount) return { ok: false, reason: 'insufficient_credits', balance } as const

    await tx.creditLedger.create({
      data: { userId, delta: -amount, kind: 'spend', reason: kind, idempotencyKey },
    })
    return { ok: true, balance: balance - amount, replayed: false } as const
  })
}

export interface GrantInput {
  userId: string
  credits: number
  kind: 'subscription_grant' | 'pack'
  reason: string
  /** Stripe invoice id (subscription) or payment intent id (pack); used to find the grant again on a refund. */
  refId: string
  idempotencyKey: string
}

/**
 * Add credits inside the caller's transaction. Returns false (and writes nothing) if this idempotency key was already
 * applied. Used by the webhook; there is deliberately no public way to grant credits without a Stripe event.
 */
export async function grantCredits(tx: Pick<Tx, 'creditLedger'>, input: GrantInput): Promise<boolean> {
  if (!Number.isSafeInteger(input.credits) || input.credits <= 0 || input.credits > MAX_CREDITS_PER_GRANT) {
    throw new CreditsError('invalid_input', 'credits must be a positive whole number')
  }
  const existing = await tx.creditLedger.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) return false
  await tx.creditLedger.create({
    data: {
      userId: input.userId,
      delta: input.credits,
      kind: input.kind,
      reason: input.reason,
      refId: input.refId,
      idempotencyKey: input.idempotencyKey,
    },
  })
  return true
}

/**
 * Take credits back after a refund, inside the caller's transaction. `target` is the total that should have been
 * clawed back for `refId` so far (a partial refund asks for a proportional part); what earlier clawbacks for the same
 * refId already took is subtracted, and the result is capped at the user's current balance, so a clawback can never
 * push the balance below zero. Credits the user has already spent are not recovered. Returns the amount taken.
 */
export async function clawbackCredits(
  tx: Tx,
  input: { userId: string; refId: string; target: number; reason: string; idempotencyKey: string },
): Promise<number> {
  await lockUser(tx, input.userId)
  const existing = await tx.creditLedger.findUnique({ where: { idempotencyKey: input.idempotencyKey } })
  if (existing) return -existing.delta

  const earlier = await tx.creditLedger.aggregate({
    where: { userId: input.userId, kind: 'refund', refId: input.refId },
    _sum: { delta: true },
  })
  const alreadyTaken = -(earlier._sum.delta ?? 0)
  const wanted = Math.max(0, input.target - alreadyTaken)
  const take = Math.min(wanted, Math.max(0, await balanceIn(tx, input.userId)))
  // Record a row even when nothing could be taken, so the same event is not re-evaluated.
  await tx.creditLedger.create({
    data: {
      userId: input.userId,
      delta: -take,
      kind: 'refund',
      reason: input.reason,
      refId: input.refId,
      idempotencyKey: input.idempotencyKey,
    },
  })
  return take
}
