// A failed response's body must be discarded before the error is thrown: left unread (paused), undici crashed the
// whole process with assert(!this.paused) when the server then closed the connection (freehire daily sync,
// 2026-11-10, after Workday 429s). Tested through one exported fetcher; the other scrapers use the same line.
import { fetchFourDayWeekJobs } from '@/lib/jobs/fourDayWeek'

jest.mock('@/lib/prisma', () => ({ prisma: {} }))

it('discards the body of a failed response before throwing', async () => {
  const cancel = jest.fn()
  const body = new ReadableStream({ cancel })
  const fetchImpl = jest.fn(async () => new Response(body, { status: 429, statusText: 'Too Many Requests' }))
  await expect(fetchFourDayWeekJobs(fetchImpl as unknown as typeof fetch)).rejects.toThrow('429')
  expect(cancel).toHaveBeenCalled()
})
