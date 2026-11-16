// Runs the remote-or-hybrid / everything-else split against a real Postgres, where NULL behaves as SQL says (NOT(NULL) is NULL).
// Skipped unless BLEND_TEST_DATABASE_URL is set (CI has no database); refuses any database whose name does not contain "test",
// because it empties the Job table.
//
//   BLEND_TEST_DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/sixfig_test npx jest __tests__/jobs/workModeBlend.integration
import { PrismaClient } from '@prisma/client'

import { FLEX_WHERE, OTHER_WHERE } from '../../lib/jobs/workModeBlend'

const url = process.env.BLEND_TEST_DATABASE_URL
const suite = url ? describe : describe.skip

suite('FLEX_WHERE and OTHER_WHERE (real Postgres)', () => {
  let db: PrismaClient
  const flags = [null, true, false]
  const modes = [null, 'remote', 'hybrid', 'onsite']

  beforeAll(async () => {
    if (!/test/i.test(new URL(url as string).pathname)) throw new Error('Refusing: the database name must contain "test".')
    db = new PrismaClient({ datasourceUrl: url })
    await db.$executeRawUnsafe('TRUNCATE "Job" CASCADE')
    for (const remote of flags) {
      for (const remoteMode of modes) {
        await db.job.create({
          data: { id: `j-${remote}-${remoteMode}`, title: 'Engineer', company: 'Acme', source: 'ats:test', minAnnual: 100000n, maxAnnual: 120000n, currency: 'USD', roleSlug: 'engineer', remote, remoteMode },
        })
      }
    }
  })
  afterAll(async () => {
    await db?.$disconnect()
  })

  it('every job is in exactly one stream, whichever of the flag and the mode are empty', async () => {
    const [all, flex, other] = await Promise.all([
      db.job.findMany({ select: { id: true } }),
      db.job.findMany({ where: FLEX_WHERE, select: { id: true } }),
      db.job.findMany({ where: OTHER_WHERE, select: { id: true } }),
    ])
    expect(all.length).toBe(flags.length * modes.length)
    const f = new Set(flex.map((j) => j.id))
    const o = new Set(other.map((j) => j.id))
    expect([...f].filter((id) => o.has(id))).toEqual([]) // no job in both
    expect(f.size + o.size).toBe(all.length) // no job in neither
  })

  it('remote and hybrid are the flex stream; on-site, not stated and the plain "not remote" flag are the rest', async () => {
    const flex = new Set((await db.job.findMany({ where: FLEX_WHERE, select: { id: true } })).map((j) => j.id))
    expect(flex.has('j-null-remote')).toBe(true)
    expect(flex.has('j-false-hybrid')).toBe(true)
    expect(flex.has('j-true-null')).toBe(true) // flagged remote, mode empty
    expect(flex.has('j-false-onsite')).toBe(false)
    expect(flex.has('j-null-null')).toBe(false) // nothing stated stays listed, in the other stream
    expect(flex.has('j-false-null')).toBe(false)
  })
})
