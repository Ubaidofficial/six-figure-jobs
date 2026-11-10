const create = jest.fn()
const update = jest.fn()
jest.mock('@/lib/prisma', () => ({ prisma: { feedback: { create: (...a: unknown[]) => create(...a), update: (...a: unknown[]) => update(...a) } } }))

import { POST } from '@/app/api/feedback/route'

const PNG = 'data:image/png;base64,iVBORw0KGgo='
let ipCounter = 0

function post(body: unknown, ip = `203.0.113.${++ipCounter}`) {
  return POST(
    new Request('https://www.6figjobs.com/api/feedback', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
      body: JSON.stringify(body),
    }),
  )
}

beforeEach(() => {
  create.mockReset().mockResolvedValue({ id: 'f1' })
  update.mockReset().mockResolvedValue({ id: 'f1' })
})

describe('POST /api/feedback', () => {
  it('saves the feedback, then the screenshot in a second write', async () => {
    const res = await post({ type: 'bug', message: 'The filter is broken', screenshot: PNG, url: 'https://www.6figjobs.com/remote' })
    expect(res.status).toBe(200)
    expect(create.mock.calls[0][0].data).toMatchObject({ type: 'bug', hasScreenshot: true, status: 'new' })
    expect(create.mock.calls[0][0].select).toEqual({ id: true })
    expect(update.mock.calls[0][0]).toMatchObject({ where: { id: 'f1' }, data: { screenshot: PNG } })
  })

  it('keeps the feedback when the screenshot cannot be stored (column not migrated yet)', async () => {
    update.mockRejectedValue(new Error('The column `screenshot` does not exist'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const res = await post({ type: 'idea', message: 'Add more filters', screenshot: PNG })
    expect(res.status).toBe(200)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('ignores anything that is not an image data URL', async () => {
    await post({ type: 'bug', message: 'Something odd', screenshot: 'javascript:alert(1)' })
    expect(create.mock.calls[0][0].data.hasScreenshot).toBe(false)
    expect(update).not.toHaveBeenCalled()
  })

  it('limits each client to 6 messages per 10 minutes', async () => {
    const statuses: number[] = []
    for (let i = 0; i < 7; i++) statuses.push((await post({ type: 'bug', message: `Message number ${i}` }, '198.51.100.7')).status)
    expect(statuses.slice(0, 6)).toEqual([200, 200, 200, 200, 200, 200])
    expect(statuses[6]).toBe(429)
  })
})
