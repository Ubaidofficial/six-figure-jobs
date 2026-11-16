// Real Postgres, as the other history integration tests: skipped unless HISTORY_TEST_DATABASE_URL is set, and refuses a database
// whose name does not contain "test".
import { PrismaClient } from '@prisma/client'

import { benefitEvidenceRecords, remoteEvidenceRecord, saveEvidence } from '../../lib/history/evidence'

const url = process.env.HISTORY_TEST_DATABASE_URL
const suite = url ? describe : describe.skip

suite('saveEvidence (real Postgres)', () => {
  let db: PrismaClient
  beforeAll(async () => {
    if (!/test/i.test(new URL(url as string).pathname)) throw new Error('Refusing: the database name must contain "test".')
    db = new PrismaClient({ datasourceUrl: url })
    await db.$executeRawUnsafe('TRUNCATE "JobEvidence"')
  })
  afterAll(async () => {
    await db?.$disconnect()
  })

  const benefit = { category: 'k401', label: '401(k) match', quote: '401(k) with a 4% company match' } as const

  it('saves new rows, reports how many were new, and never stores the same (job, field, value) twice', async () => {
    const records = [...benefitEvidenceRecords('j1', [benefit]), remoteEvidenceRecord('j1', { mode: 'remote', quote: 'This is a fully remote role.' })]
    expect(await saveEvidence(db, records)).toBe(2)
    expect(await saveEvidence(db, records)).toBe(0) // a rerun adds nothing
    expect(await db.jobEvidence.count()).toBe(2)
    expect(await saveEvidence(db, [])).toBe(0)
  })

  it('keeps the sentence and the reader version, and allows the same value on another job', async () => {
    expect(await saveEvidence(db, benefitEvidenceRecords('j2', [benefit]))).toBe(1)
    const row = await db.jobEvidence.findFirst({ where: { jobId: 'j2', field: 'benefits' } })
    expect(row).toMatchObject({ value: '401(k) match', quote: '401(k) with a 4% company match', extractor: 'benefitsEvidence', extractorVersion: 1 })
  })
})
