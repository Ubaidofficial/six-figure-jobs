jest.mock('../../lib/ai/freeLlm', () => {
  const actual = jest.requireActual('../../lib/ai/freeLlm')
  return { ...actual, chatOpenRouter: jest.fn(), chatCloudflare: jest.fn() }
})

import { createFreeAsker, pickFreeProvider } from '../../lib/ai/freeEnrichRunner'
import { EmptyAnswer, QuotaExhausted, chatCloudflare, chatOpenRouter } from '../../lib/ai/freeLlm'

const openRouter = chatOpenRouter as jest.Mock
const cloudflare = chatCloudflare as jest.Mock

beforeEach(() => {
  openRouter.mockReset()
  cloudflare.mockReset()
})

describe('pickFreeProvider', () => {
  const both = { OPENROUTER_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' }

  it('prefers Cloudflare (the reliable one) on auto, and respects a request', () => {
    expect(pickFreeProvider(both, 'auto')).toBe('cloudflare')
    expect(pickFreeProvider(both, undefined)).toBe('cloudflare')
    expect(pickFreeProvider(both, 'openrouter')).toBe('openrouter')
    expect(pickFreeProvider(both, 'none')).toBe('none')
  })

  it('falls back to what has a key, and to none without one', () => {
    expect(pickFreeProvider({ OPENROUTER_API_KEY: 'k' }, 'auto')).toBe('openrouter')
    expect(pickFreeProvider({ CLOUDFLARE_ACCOUNT_ID: 'a' }, 'auto')).toBe('none') // needs the token too
    expect(pickFreeProvider({}, 'cloudflare')).toBe('none')
  })
})

describe('createFreeAsker', () => {
  it('asks Cloudflare with its default free model', async () => {
    cloudflare.mockResolvedValue({ text: '{}', provider: 'cloudflare', model: 'm' })
    const ask = await createFreeAsker({ provider: 'cloudflare', env: { CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' } })
    await ask('hello')
    expect(cloudflare).toHaveBeenCalledWith(expect.objectContaining({ model: '@cf/meta/llama-3.1-8b-instruct', accountId: 'a', apiToken: 't' }))
  })

  it('retries a rate-limited OpenRouter model twice, then moves to the next free model', async () => {
    const sleeps: number[] = []
    openRouter
      .mockRejectedValueOnce(new QuotaExhausted('openrouter', '429'))
      .mockRejectedValueOnce(new QuotaExhausted('openrouter', '429'))
      .mockRejectedValueOnce(new QuotaExhausted('openrouter', '429'))
      .mockResolvedValueOnce({ text: 'ok', provider: 'openrouter', model: 'b:free' })
    const env = { OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'a:free' }
    const ask = await createFreeAsker({ provider: 'openrouter', env, sleep: async (ms) => void sleeps.push(ms) })
    // a single configured model has nowhere to move to: the error reaches the caller after two retries
    await expect(ask('x')).rejects.toBeInstanceOf(QuotaExhausted)
    expect(sleeps).toEqual([20_000, 20_000])
    expect(openRouter).toHaveBeenCalledTimes(3)
  })

  it('treats an empty answer as "try the next model" and lets other errors through', async () => {
    openRouter.mockRejectedValueOnce(new Error('boom'))
    const ask = await createFreeAsker({ provider: 'openrouter', env: { OPENROUTER_API_KEY: 'k', OPENROUTER_MODEL: 'a:free' } })
    await expect(ask('x')).rejects.toThrow('boom')
    openRouter.mockRejectedValueOnce(new EmptyAnswer('no text'))
    await expect(ask('x')).rejects.toBeInstanceOf(EmptyAnswer) // only one model: nowhere to go
  })
})
