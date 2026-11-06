// In-memory stand-in for the slice of Prisma that lib/billing uses. It models the two database behaviours the billing code
// relies on:
//   * unique constraints (CreditLedger.idempotencyKey, StripeEvent.id, User.stripeCustomerId) and INSERT ... ON CONFLICT
//     DO NOTHING (createMany skipDuplicates);
//   * `SELECT ... FOR UPDATE` on a User row: a per-user lock held until the transaction ends, so a second transaction
//     that asks for the same lock waits. Pass { lock: false } to turn the lock off and see the race it prevents.
// Every operation yields to the event loop first, so concurrent callers genuinely interleave.
// What it does NOT model: Postgres isolation levels, real deadlocks, or the SQL itself. It is not a database.

type Row = Record<string, any>

const tick = () => new Promise<void>((r) => setImmediate(r))

export class FakeUniqueError extends Error {
  code = 'P2002'
}

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    if (cond && typeof cond === 'object' && 'in' in cond) return (cond.in as unknown[]).includes(row[key])
    return row[key] === cond
  })
}

export function createFakePrisma(options: { lock?: boolean } = {}) {
  const useLock = options.lock !== false
  const tables = {
    user: [] as Row[],
    creditLedger: [] as Row[],
    subscription: [] as Row[],
    stripeEvent: [] as Row[],
  }
  let seq = 0
  const locks = new Map<string, Promise<void>>()

  function makeClient(undo: Array<() => void>, release: Array<() => void>) {
    const insert = (table: Row[], row: Row, uniques: string[]) => {
      for (const u of uniques) {
        if (row[u] != null && table.some((r) => r[u] === row[u])) throw new FakeUniqueError(`Unique constraint on ${u}`)
      }
      table.push(row)
      undo.push(() => {
        table.splice(table.indexOf(row), 1)
      })
      return row
    }

    return {
      user: {
        async findUnique({ where }: { where: Row }) {
          await tick()
          return tables.user.find((r) => matches(r, where)) ?? null
        },
        async updateMany({ where, data }: { where: Row; data: Row }) {
          await tick()
          const hit = tables.user.filter((r) => matches(r, where))
          for (const r of hit) {
            const before = { ...r }
            Object.assign(r, data)
            undo.push(() => Object.assign(r, before))
          }
          return { count: hit.length }
        },
      },
      creditLedger: {
        async findUnique({ where }: { where: Row }) {
          await tick()
          return tables.creditLedger.find((r) => matches(r, where)) ?? null
        },
        async findFirst({ where }: { where: Row }) {
          await tick()
          return tables.creditLedger.find((r) => matches(r, where)) ?? null
        },
        async aggregate({ where }: { where: Row }) {
          await tick()
          const rows = tables.creditLedger.filter((r) => matches(r, where))
          return { _sum: { delta: rows.length ? rows.reduce((s, r) => s + r.delta, 0) : null } }
        },
        async create({ data }: { data: Row }) {
          await tick()
          return insert(tables.creditLedger, { id: `led_${++seq}`, refId: null, createdAt: new Date(), ...data }, ['idempotencyKey'])
        },
      },
      subscription: {
        async findUnique({ where }: { where: Row }) {
          await tick()
          return tables.subscription.find((r) => matches(r, where)) ?? null
        },
        async findMany({ where }: { where: Row }) {
          await tick()
          return tables.subscription.filter((r) => matches(r, where))
        },
        async findFirst({ where }: { where: Row }) {
          await tick()
          return tables.subscription.find((r) => matches(r, where)) ?? null
        },
        async create({ data }: { data: Row }) {
          await tick()
          return insert(tables.subscription, { id: `sub_row_${++seq}`, ...data }, ['stripeSubscriptionId'])
        },
        async update({ where, data }: { where: Row; data: Row }) {
          await tick()
          const row = tables.subscription.find((r) => matches(r, where))
          if (!row) throw new Error('not found')
          const before = { ...row }
          Object.assign(row, data)
          undo.push(() => Object.assign(row, before))
          return row
        },
      },
      stripeEvent: {
        async createMany({ data, skipDuplicates }: { data: Row[]; skipDuplicates?: boolean }) {
          await tick()
          let count = 0
          for (const d of data) {
            if (tables.stripeEvent.some((r) => r.id === d.id)) {
              if (skipDuplicates) continue
              throw new FakeUniqueError('Unique constraint on id')
            }
            insert(tables.stripeEvent, { processedAt: new Date(), ...d }, [])
            count++
          }
          return { count }
        },
      },
      // `SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`
      async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
        if (!/FOR UPDATE/i.test(strings.join('?'))) throw new Error('fake only supports the FOR UPDATE lock query')
        const userId = String(values[0])
        if (useLock) {
          // Wait for whoever holds this user's lock, then take it until the transaction ends.
          while (locks.has(userId)) await locks.get(userId)
          let free!: () => void
          locks.set(userId, new Promise<void>((r) => (free = r)))
          release.push(() => {
            locks.delete(userId)
            free()
          })
        }
        await tick()
        return tables.user.filter((r) => r.id === userId).map((r) => ({ id: r.id }))
      },
    }
  }

  const prisma = {
    ...makeClient([], []),
    async $transaction<T>(fn: (tx: any) => Promise<T>, _opts?: unknown): Promise<T> {
      const undo: Array<() => void> = []
      const release: Array<() => void> = []
      try {
        return await fn(makeClient(undo, release))
      } catch (err) {
        for (const u of undo.reverse()) u() // roll back everything this transaction wrote
        throw err
      } finally {
        for (const r of release) r()
      }
    },
  }

  return {
    prisma,
    tables,
    addUser(id: string, extra: Row = {}) {
      const row = { id, email: `${id}@example.test`, name: null, stripeCustomerId: null, ...extra }
      tables.user.push(row)
      return row
    },
    balance: (userId: string) => tables.creditLedger.filter((r) => r.userId === userId).reduce((s, r) => s + r.delta, 0),
  }
}
