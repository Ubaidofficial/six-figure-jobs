// SLOW_QUERY_LOG_MS is off by default: the client is then built as before, with no query event subscription.
describe('slow query log', () => {
  const originalEnv = { ...process.env }
  afterEach(() => {
    process.env = { ...originalEnv }
    delete (globalThis as { prisma?: unknown }).prisma
    jest.resetModules()
    jest.dontMock('@prisma/client')
  })

  function load(slowMs?: string) {
    jest.resetModules()
    delete (globalThis as { prisma?: unknown }).prisma // outside production the client is kept on globalThis
    if (slowMs === undefined) delete process.env.SLOW_QUERY_LOG_MS
    else process.env.SLOW_QUERY_LOG_MS = slowMs
    const handlers: Array<(e: { duration: number; query: string }) => void> = []
    const ctor = jest.fn().mockImplementation(() => ({ $on: (_: string, h: (e: { duration: number; query: string }) => void) => handlers.push(h) }))
    jest.doMock('@prisma/client', () => ({ PrismaClient: ctor }))
    require('../../lib/prisma')
    return { ctor, handlers }
  }

  it('builds the client with only the error log and no subscription when unset', () => {
    const { ctor, handlers } = load()
    expect(ctor).toHaveBeenCalledTimes(1)
    expect(ctor.mock.calls[0][0].log).toEqual(['error'])
    expect(handlers).toHaveLength(0)
  })

  it('logs only queries at or over the limit, with the SQL and no values, when set', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined)
    const { ctor, handlers } = load('3000')
    expect(ctor.mock.calls[0][0].log).toEqual([{ emit: 'event', level: 'query' }, 'error'])
    expect(handlers).toHaveLength(1)
    handlers[0]({ duration: 2999, query: 'SELECT 1' })
    expect(warn).not.toHaveBeenCalled()
    handlers[0]({ duration: 4210, query: 'SELECT  *\n FROM "Job" WHERE id = $1' })
    expect(warn).toHaveBeenCalledWith('[slow-query] 4210ms SELECT * FROM "Job" WHERE id = $1')
    warn.mockRestore()
  })
})
