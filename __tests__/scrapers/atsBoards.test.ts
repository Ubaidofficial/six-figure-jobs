import {
  boardSlugGuesses,
  boardTitles,
  boardUrl,
  companyKey,
  isValidBoard,
  probeBoard,
  titlesFrom,
  type FetchLike,
} from '../../lib/scrapers/atsBoards'

/** A fake network: url substring -> response body (JSON value or text). Anything else is a 404. */
function fakeFetch(routes: Record<string, unknown>): FetchLike & { calls: string[] } {
  const calls: string[] = []
  const fn = (async (url: string) => {
    calls.push(url)
    const key = Object.keys(routes).find((k) => url.includes(k))
    if (!key) return { ok: false, status: 404, text: async () => '' }
    const body = routes[key]
    return { ok: true, status: 200, text: async () => (typeof body === 'string' ? body : JSON.stringify(body)) }
  }) as FetchLike & { calls: string[] }
  fn.calls = calls
  return fn
}

describe('names', () => {
  it('keys a company without case, punctuation or corporate suffixes', () => {
    expect(companyKey('Acme Labs GmbH')).toBe('acme labs')
    expect(companyKey('ACME, Inc.')).toBe('acme')
  })

  it('guesses board names', () => {
    expect(boardSlugGuesses('Acme Labs GmbH')).toEqual(['acme-labs-gmbh', 'acmelabsgmbh', 'acme-labs', 'acmelabs'])
    expect(boardSlugGuesses('Lemon.io')).toEqual(['lemon-io', 'lemonio', 'lemon'])
    expect(boardSlugGuesses('')).toEqual([])
  })

  it('refuses anything that is not a board name', () => {
    expect(isValidBoard('greenhouse', 'acme')).toBe(true)
    expect(isValidBoard('greenhouse', '../etc')).toBe(false)
    expect(isValidBoard('teamtailor', 'acme.teamtailor.com')).toBe(true)
    expect(isValidBoard('teamtailor', 'acme')).toBe(false)
    expect(isValidBoard('personio', 'acme.jobs.personio.de')).toBe(false)
  })

  it('builds the board URLs the ATS scrapers read', () => {
    expect(boardUrl('greenhouse', 'acme')).toBe('https://boards.greenhouse.io/acme')
    expect(boardUrl('lever', 'acme')).toBe('https://jobs.lever.co/acme')
    expect(boardUrl('recruitee', 'acme')).toBe('https://acme.recruitee.com')
    expect(boardUrl('bamboohr', 'acme.bamboohr.com')).toBe('https://acme.bamboohr.com')
  })
})

describe('titlesFrom', () => {
  it('reads each vendor list shape', () => {
    expect(titlesFrom('greenhouse', { jobs: [{ title: 'A' }, { title: 'B' }] })).toEqual(['A', 'B'])
    expect(titlesFrom('lever', [{ text: 'C' }])).toEqual(['C'])
    expect(titlesFrom('smartrecruiters', { content: [{ name: 'D' }] })).toEqual(['D'])
    expect(titlesFrom('recruitee', { offers: [{ title: 'E' }] })).toEqual(['E'])
    expect(titlesFrom('bamboohr', { result: [{ jobOpeningName: 'F' }] })).toEqual(['F'])
    expect(titlesFrom('teamtailor', '<rss><channel><item><title><![CDATA[G]]></title></item></channel></rss>')).toEqual(['G'])
    expect(titlesFrom('ashby', null)).toEqual([])
  })
})

describe('boardTitles', () => {
  it('returns [] for a missing board, bad JSON, or an invalid name, without calling the network for the last', async () => {
    const f = fakeFetch({ 'boards-api.greenhouse.io/v1/boards/broken/': 'not json' })
    expect(await boardTitles('greenhouse', 'nope', f)).toEqual([])
    expect(await boardTitles('greenhouse', 'broken', f)).toEqual([])
    f.calls.length = 0
    expect(await boardTitles('greenhouse', '../x', f)).toEqual([])
    expect(f.calls).toEqual([])
  })
})

describe('probeBoard', () => {
  it('confirms a board that lists one of the company’s known titles', async () => {
    const f = fakeFetch({ 'boards/acme/jobs': { jobs: [{ title: 'Senior Backend Engineer (m/f/d)' }, { title: 'Designer' }] } })
    const found = await probeBoard('Acme', ['Senior Backend Engineer'], f)
    expect(found).toEqual({ vendor: 'greenhouse', slug: 'acme', url: 'https://boards.greenhouse.io/acme', postings: 2, confirmed: true })
  })

  it('reports a board with postings but no matching title as unconfirmed', async () => {
    const f = fakeFetch({ 'boards/acme/jobs': { jobs: [{ title: 'Pastry Chef' }] } })
    expect(await probeBoard('Acme', ['Senior Backend Engineer'], f)).toMatchObject({ slug: 'acme', confirmed: false })
  })

  it('prefers a later confirmed board over an earlier unconfirmed one (another company, same name)', async () => {
    const f = fakeFetch({
      'boards/acme/jobs': { jobs: [{ title: 'Pastry Chef' }] },
      'api.lever.co/v0/postings/acme': [{ text: 'Senior Backend Engineer' }],
    })
    expect(await probeBoard('Acme', ['Senior Backend Engineer'], f)).toMatchObject({ vendor: 'lever', confirmed: true })
  })

  it('returns null when no guess lists anything', async () => {
    expect(await probeBoard('Nobody Inc', ['x'], fakeFetch({}))).toBeNull()
  })

  it('tries the Teamtailor host form', async () => {
    const f = fakeFetch({ 'acme.teamtailor.com/jobs.rss': '<rss><item><title>Product Manager</title></item></rss>' })
    expect(await probeBoard('Acme', ['Product Manager'], f)).toMatchObject({ vendor: 'teamtailor', slug: 'acme.teamtailor.com', confirmed: true })
  })
})
