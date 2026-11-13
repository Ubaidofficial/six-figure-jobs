import {
  DailyCap,
  FreeOnlyViolation,
  QuotaExhausted,
  chatCloudflare,
  chatOpenRouter,
  isCloudflareModel,
  isFreeOpenRouterModel,
  parseJsonObject,
} from '@/lib/ai/freeLlm'

const reply = (status: number, body: unknown) => async () => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
})
const messages = [{ role: 'user' as const, content: 'hi' }]

describe('free-only guard', () => {
  it('accepts only ":free" OpenRouter models', () => {
    for (const ok of ['meta-llama/llama-3.3-70b-instruct:free', 'google/gemma-3-27b-it:free', 'qwen/qwen3-coder:free']) {
      expect(isFreeOpenRouterModel(ok)).toBe(true)
    }
    for (const bad of ['openai/gpt-4o', 'anthropic/claude-sonnet-4', 'meta-llama/llama-3.3-70b-instruct', 'x:free', ':free', 'a/b:free-ish', '']) {
      expect(isFreeOpenRouterModel(bad)).toBe(false)
    }
  })

  it('refuses a paid OpenRouter model before any network call', async () => {
    const fetchImpl = jest.fn()
    await expect(chatOpenRouter({ apiKey: 'k', model: 'openai/gpt-4o', messages, fetchImpl })).rejects.toBeInstanceOf(FreeOnlyViolation)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('stops at once on 402, which means the call would use credits', async () => {
    await expect(
      chatOpenRouter({ apiKey: 'k', model: 'meta-llama/llama-3.3-70b-instruct:free', messages, fetchImpl: reply(402, { error: 'no credits' }) }),
    ).rejects.toBeInstanceOf(FreeOnlyViolation)
  })

  it('ends the day on 429 instead of retrying', async () => {
    const err = await chatOpenRouter({ apiKey: 'k', model: 'google/gemma-3-27b-it:free', messages, fetchImpl: reply(429, 'slow down') }).catch((e) => e)
    expect(err).toBeInstanceOf(QuotaExhausted)
    expect((err as QuotaExhausted).provider).toBe('openrouter')
  })

  it('refuses a Cloudflare id that is not a Workers AI model', async () => {
    expect(isCloudflareModel('@cf/meta/llama-3.1-8b-instruct')).toBe(true)
    for (const bad of ['gpt-4', '@hf/x', 'meta/llama', '']) expect(isCloudflareModel(bad)).toBe(false)
    const fetchImpl = jest.fn()
    await expect(chatCloudflare({ accountId: 'a', apiToken: 't', model: 'gpt-4', messages, fetchImpl })).rejects.toBeInstanceOf(FreeOnlyViolation)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('treats a Cloudflare "daily free allocation" answer as the day\'s quota used up', async () => {
    const body = { success: false, errors: [{ code: 4006, message: 'you have used up your daily free allocation of 10,000 neurons' }] }
    await expect(
      chatCloudflare({ accountId: 'a', apiToken: 't', model: '@cf/meta/llama-3.1-8b-instruct', messages, fetchImpl: reply(400, body) }),
    ).rejects.toBeInstanceOf(QuotaExhausted)
  })
})

describe('reading the answers', () => {
  it('returns the text of a good OpenRouter answer', async () => {
    const out = await chatOpenRouter({
      apiKey: 'k',
      model: 'google/gemma-3-27b-it:free',
      messages,
      fetchImpl: reply(200, { choices: [{ message: { content: '{"ok":true}' } }] }),
    })
    expect(out).toEqual({ text: '{"ok":true}', provider: 'openrouter', model: 'google/gemma-3-27b-it:free' })
  })

  it('returns the text of a good Cloudflare answer', async () => {
    const out = await chatCloudflare({
      accountId: 'a',
      apiToken: 't',
      model: '@cf/meta/llama-3.1-8b-instruct',
      messages,
      fetchImpl: reply(200, { success: true, result: { response: 'hello' } }),
    })
    expect(out.text).toBe('hello')
    expect(out.provider).toBe('cloudflare')
  })

  it('does not send the key to a URL other than the provider\'s', async () => {
    const fetchImpl = jest.fn(reply(200, { choices: [{ message: { content: 'x' } }] }))
    await chatOpenRouter({ apiKey: 'secret', model: 'google/gemma-3-27b-it:free', messages, fetchImpl })
    expect(fetchImpl.mock.calls[0][0]).toBe('https://openrouter.ai/api/v1/chat/completions')
  })

  it('fails on an empty answer or a server error, without calling it quota', async () => {
    await expect(chatOpenRouter({ apiKey: 'k', model: 'google/gemma-3-27b-it:free', messages, fetchImpl: reply(200, { choices: [] }) })).rejects.toThrow(/no text/)
    await expect(chatOpenRouter({ apiKey: 'k', model: 'google/gemma-3-27b-it:free', messages, fetchImpl: reply(500, 'oops') })).rejects.toThrow(/500/)
  })
})

describe('parseJsonObject', () => {
  it('finds the object in a fenced or chatty answer, and gives null otherwise', () => {
    expect(parseJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 })
    expect(parseJsonObject('Sure! Here you go: {"a":{"b":2}} Hope that helps.')).toEqual({ a: { b: 2 } })
    for (const bad of ['', 'no json', '{broken', '[1,2]', '}{']) expect(parseJsonObject(bad)).toBeNull()
  })
})

describe('DailyCap', () => {
  it('allows exactly the limit, counting what was already used today', () => {
    const cap = new DailyCap(3, 1)
    expect([cap.take(), cap.take(), cap.take()]).toEqual([true, true, false])
    expect(cap.remaining).toBe(0)
    expect(new DailyCap(0).take()).toBe(false)
    expect(new DailyCap(5, 99).remaining).toBe(0)
  })
})
