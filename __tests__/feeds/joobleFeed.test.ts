import { buildJoobleFeedXml, buildJoobleJobXml, cdata, formatJoobleDate, joobleJobType, type JoobleJob } from '../../lib/feeds/joobleFeed'

const NOW = Date.parse('2026-11-05T12:00:00Z')
const SITE = 'https://www.6figjobs.com'

function job(over: Partial<JoobleJob> = {}): JoobleJob {
  return {
    id: 'clx1abc',
    title: 'Senior Backend Engineer',
    company: 'Acme & Sons',
    locationRaw: 'New York, NY',
    remote: false,
    remoteMode: null,
    descriptionHtml: '<p>Build <b>APIs</b>. Pay is great.</p><ul><li>Go</li><li>SQL</li></ul>',
    employmentType: 'full-time',
    postedAt: new Date('2026-11-01T10:00:00Z'),
    createdAt: new Date('2026-11-01T10:00:00Z'),
    updatedAt: new Date('2026-11-03T10:00:00Z'),
    validThrough: new Date('2026-12-01T00:00:00Z'),
    minAnnual: BigInt(150000),
    maxAnnual: BigInt(190000),
    currency: 'USD',
    ...over,
  }
}

describe('Jooble feed', () => {
  it('formats dates as DD.MM.YYYY', () => {
    expect(formatJoobleDate(new Date('2026-01-05T23:59:00Z'))).toBe('05.01.2026')
  })

  it('does not name where we found the job', () => {
    const xml = buildJoobleJobXml(job({ id: 'board:freehire:https://himalayas.app/companies/acme/jobs/x' }), SITE, NOW)!
    expect(xml.toLowerCase()).not.toContain('freehire')
    expect(xml.toLowerCase()).not.toContain('himalayas')
  })

  it('wraps text in CDATA and splits a literal ]]>', () => {
    expect(cdata('a & b <c>')).toBe('<![CDATA[a & b <c>]]>')
    expect(cdata('x]]>y')).toBe('<![CDATA[x]]]]><![CDATA[>y]]>')
    expect(cdata('a\u0000b\u000Bc')).toBe('<![CDATA[abc]]>')
  })

  it('emits every required tag, CDATA content and the optional ones when known', () => {
    const xml = buildJoobleJobXml(job(), SITE, NOW)!
    const shortId = xml.match(/\/job\/senior-backend-engineer-j-([a-z0-9]+)\]\]>/)?.[1]
    expect(shortId).toBeTruthy()
    expect(xml).toContain(`<job id="${shortId}">`)
    expect(xml).toContain('<name><![CDATA[Senior Backend Engineer]]></name>')
    expect(xml).toContain('<region><![CDATA[New York, NY]]></region>')
    expect(xml).toContain('<description><![CDATA[')
    expect(xml).toContain('<company><![CDATA[Acme & Sons]]></company>')
    expect(xml).toContain('<pubdate>01.11.2026</pubdate>')
    expect(xml).toContain('<updated>03.11.2026</updated>')
    expect(xml).toContain('<expire>01.12.2026</expire>')
    expect(xml).toContain('<jobtype>full-time</jobtype>')
    expect(xml).toMatch(/<salary><!\[CDATA\[.*150.*190.*\]\]><\/salary>/)
    expect(xml).not.toContain('<p>') // description is plain text
    expect(xml).toContain('Build APIs. Pay is great.\n- Go\n- SQL')
  })

  it('adds Remote to the region and skips optional tags it does not have', () => {
    const xml = buildJoobleJobXml(job({ remote: true, validThrough: null, employmentType: null, company: null, minAnnual: null, maxAnnual: null }), SITE, NOW)!
    expect(xml).toContain('<region><![CDATA[New York, NY, Remote]]></region>')
    expect(xml).not.toContain('<expire>')
    expect(xml).not.toContain('<jobtype>')
    expect(xml).not.toContain('<company>')
    expect(xml).not.toContain('<salary>')
  })

  it('skips jobs missing a required field', () => {
    expect(buildJoobleJobXml(job({ descriptionHtml: '' }), SITE, NOW)).toBeNull()
    expect(buildJoobleJobXml(job({ locationRaw: null }), SITE, NOW)).toBeNull()
    expect(buildJoobleJobXml(job({ title: ' ' }), SITE, NOW)).toBeNull()
  })

  it('skips jobs older than 45 days by publication and update date', () => {
    const old = new Date('2026-09-01T00:00:00Z')
    expect(buildJoobleJobXml(job({ postedAt: old, createdAt: old, updatedAt: old }), SITE, NOW)).toBeNull()
    expect(buildJoobleJobXml(job({ postedAt: old, createdAt: old, updatedAt: new Date('2026-11-04T00:00:00Z') }), SITE, NOW)).not.toBeNull()
  })

  it('maps job types and ignores unknown ones', () => {
    expect(joobleJobType('Part-Time')).toBe('part-time')
    expect(joobleJobType('weird')).toBeNull()
  })

  it('wraps the jobs in one <jobs> root with a utf-8 header and counts what it emitted', () => {
    const { xml, count } = buildJoobleFeedXml([job(), job({ id: 'b2', descriptionHtml: '' })], SITE, NOW)
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>\n<jobs>')).toBe(true)
    expect(xml.trim().endsWith('</jobs>')).toBe(true)
    expect(count).toBe(1)
    expect(xml.match(/<job id=/g)).toHaveLength(1)
  })
})
