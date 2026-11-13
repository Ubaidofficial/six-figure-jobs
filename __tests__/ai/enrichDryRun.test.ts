import { estimateTokens, parseSampleSize, pickProvider, stripHtml } from '@/lib/ai/enrichDryRun'

describe('pickProvider', () => {
  const both = { OPENROUTER_API_KEY: 'k', CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' }
  it('uses the requested provider only when its key is set, and falls back to the first with a key', () => {
    expect(pickProvider(both, 'cloudflare')).toBe('cloudflare')
    expect(pickProvider({ CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' }, 'openrouter')).toBe('none')
    expect(pickProvider(both, 'auto')).toBe('openrouter')
    expect(pickProvider({ CLOUDFLARE_ACCOUNT_ID: 'a', CLOUDFLARE_API_TOKEN: 't' }, 'auto')).toBe('cloudflare')
    expect(pickProvider(both, 'none')).toBe('none')
  })

  it('is prompt-only without keys, and a Cloudflare id without its token is not a key', () => {
    expect(pickProvider({}, 'auto')).toBe('none')
    expect(pickProvider({ OPENROUTER_API_KEY: '  ' }, undefined)).toBe('none')
    expect(pickProvider({ CLOUDFLARE_ACCOUNT_ID: 'a' }, 'auto')).toBe('none')
  })
})

describe('helpers', () => {
  it('keeps the sample small: 1 to 20, default 10', () => {
    expect(parseSampleSize('5')).toBe(5)
    expect(parseSampleSize('500')).toBe(20)
    for (const bad of ['0', '-3', 'abc', '', undefined]) expect(parseSampleSize(bad)).toBe(10)
  })

  it('strips tags and estimates tokens', () => {
    expect(stripHtml('<p>Build <b>APIs</b></p>\n<ul><li>Go</li></ul>')).toBe('Build APIs Go')
    expect(stripHtml(null)).toBe('')
    expect(estimateTokens('x'.repeat(401))).toBe(101)
  })
})
