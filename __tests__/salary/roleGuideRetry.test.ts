import { __clearMemoForTests } from '../../lib/cache/memo'
import { loadRoleSalaryGuide } from '../../lib/salary/roleGuide'
import { prisma } from '../../lib/prisma'

jest.mock('../../lib/prisma', () => ({ prisma: { job: { findMany: jest.fn() } } }))

const findMany = prisma.job.findMany as unknown as jest.Mock
const prismaError = (code: string) => Object.assign(new Error(code), { code })
const row = {
  minAnnual: 150_000,
  maxAnnual: 190_000,
  currency: 'USD',
  countryCode: 'US',
  experienceLevel: 'senior',
  updatedAt: new Date('2026-11-20T00:00:00Z'),
  companyRef: { name: 'Acme', slug: 'acme' },
}

// /salary/devops-engineer and /salary/machine-learning-engineer answered 500 on 2026-11-26. With no cached guide, one
// failed read failed the page.
describe('loadRoleSalaryGuide on a database error', () => {
  beforeEach(() => {
    jest.useFakeTimers()
    __clearMemoForTests()
    findMany.mockReset()
    jest.spyOn(console, 'warn').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.useRealTimers()
    jest.restoreAllMocks()
  })

  it('retries once after a connection pool timeout and returns the guide', async () => {
    findMany.mockRejectedValueOnce(prismaError('P2024')).mockResolvedValueOnce([row])
    const guide = loadRoleSalaryGuide('devops-engineer', 100_000)
    await jest.advanceTimersByTimeAsync(1000)
    await expect(guide).resolves.toMatchObject({ listings: 1 })
    expect(findMany).toHaveBeenCalledTimes(2)
  })

  it('fails after the second transient failure, so the page shows its error state instead of an empty guide', async () => {
    findMany.mockRejectedValue(prismaError('P1001'))
    const guide = loadRoleSalaryGuide('devops-engineer', 100_000)
    const settled = expect(guide).rejects.toMatchObject({ code: 'P1001' })
    await jest.advanceTimersByTimeAsync(1000)
    await settled
    expect(findMany).toHaveBeenCalledTimes(2)
  })

  it('also retries when the connection cannot be opened at all (PrismaClientInitializationError, no code)', async () => {
    const initError = Object.assign(new Error("Can't reach database server"), { name: 'PrismaClientInitializationError', errorCode: undefined })
    findMany.mockRejectedValueOnce(initError).mockResolvedValueOnce([row])
    const guide = loadRoleSalaryGuide('devops-engineer', 100_000)
    await jest.advanceTimersByTimeAsync(1000)
    await expect(guide).resolves.toMatchObject({ listings: 1 })
    expect(findMany).toHaveBeenCalledTimes(2)
  })

  it('does not retry an error that is not a connection problem', async () => {
    findMany.mockRejectedValue(prismaError('P2009'))
    await expect(loadRoleSalaryGuide('devops-engineer', 100_000)).rejects.toMatchObject({ code: 'P2009' })
    expect(findMany).toHaveBeenCalledTimes(1)
  })
})
