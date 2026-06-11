// __tests__/seo/jobSlugParser.test.ts
import { parseJobSlugParam, buildJobSlug, getShortStableIdForJobId } from '../../lib/jobs/jobSlug'

describe('parseJobSlugParam', () => {
  describe('v2.8 -j-<shortId> format', () => {
    it('parses a normal v2.8 slug', () => {
      const result = parseJobSlugParam('senior-software-engineer-j-abc12345')
      expect(result.shortId).toBe('abc12345')
      expect(result.jobId).toBeNull()
    })

    it('parses v2.8 slug when title contains "job" (regression: slug-parser 404)', () => {
      // This was the root cause of the production 404:
      // "External Job Post" → external-job-post-j-k8mub4
      // The legacy -job- pattern was matching before -j-<shortId>
      const result = parseJobSlugParam('external-job-post-j-k8mub4')
      expect(result.shortId).toBe('k8mub4')
      expect(result.jobId).toBeNull()
    })

    it('parses v2.8 slug when title contains "job" in different positions', () => {
      // "Job Market Analyst"
      const result1 = parseJobSlugParam('job-market-analyst-j-x9y8z7')
      expect(result1.shortId).toBe('x9y8z7')
      expect(result1.jobId).toBeNull()

      // "My Job Application"
      const result2 = parseJobSlugParam('my-job-application-j-a1b2c3')
      expect(result2.shortId).toBe('a1b2c3')
      expect(result2.jobId).toBeNull()

      // "Senior Job Coach"
      const result3 = parseJobSlugParam('senior-job-coach-j-d4e5f6')
      expect(result3.shortId).toBe('d4e5f6')
      expect(result3.jobId).toBeNull()
    })

    it('parses a short (1–4 char) suffix (regression: sitemap URL → 404)', () => {
      // shortStableId() is base36 of a 32-bit FNV hash sliced to 8 chars, so a
      // small hash value yields a short suffix. The id below hashes to "ckck"
      // (4 chars). A {5,12} parser bound returned shortId=null → notFound() →
      // 404 on a URL the sitemap still listed (production "non_200" failure).
      const result = parseJobSlugParam('sr-lifecycle-marketing-manager-j-ckck')
      expect(result.shortId).toBe('ckck')
      expect(result.jobId).toBeNull()
    })

    it('roundtrips buildJobSlug → parseJobSlugParam across many ids, incl. short suffixes', () => {
      let sawShort = false
      for (let i = 0; i < 5000; i++) {
        const jobId = `ats:greenhouse:${i}`
        const slug = buildJobSlug({ id: jobId, title: 'Senior Marketing Manager' })
        const expectedShortId = getShortStableIdForJobId(jobId)
        if (expectedShortId.length <= 4) sawShort = true

        const parsed = parseJobSlugParam(slug)
        expect(parsed.shortId).toBe(expectedShortId)
      }
      // Guard the guard: ensure the loop actually exercised a short suffix.
      expect(sawShort).toBe(true)
    })

    it('roundtrips buildJobSlug → parseJobSlugParam for titles containing "job"', () => {
      const jobId = 'board:builtin:builtin-9564198'
      const slug = buildJobSlug({ id: jobId, title: 'External Job Post' })
      const shortId = getShortStableIdForJobId(jobId)

      // Slug must end with -j-<shortId>
      expect(slug).toMatch(/-j-[a-z0-9]+$/)

      // Parse must extract the shortId correctly
      const parsed = parseJobSlugParam(slug)
      expect(parsed.shortId).toBe(shortId)
      expect(parsed.jobId).toBeNull()
    })
  })

  describe('v2.7 -jid-<base64url> format', () => {
    it('parses a jid slug', () => {
      // base64url of "test:id:123" → dGVzdDppZDoxMjM
      const result = parseJobSlugParam('some-title-jid-dGVzdDppZDoxMjM')
      expect(result.jobId).toBe('test:id:123')
      expect(result.shortId).toBeNull()
    })
  })

  describe('legacy -job-<rawId> format', () => {
    it('parses a legacy slug with raw id containing colons', () => {
      const result = parseJobSlugParam('senior-engineer-job-ats:greenhouse:12345')
      expect(result.jobId).toBe('ats:greenhouse:12345')
      expect(result.externalId).toBe('12345')
      expect(result.shortId).toBeNull()
    })

    it('does NOT match legacy -job- when slug has a v2.8 -j- suffix', () => {
      // This is the critical regression check:
      // If a slug has both -job- (from title) and -j- (v2.8 suffix),
      // the v2.8 pattern MUST win.
      const result = parseJobSlugParam('data-job-coordinator-j-zz99yy')
      expect(result.shortId).toBe('zz99yy')
      expect(result.jobId).toBeNull()
    })
  })

  describe('raw id format', () => {
    it('parses a raw id with colons', () => {
      const result = parseJobSlugParam('ats:lever:abc123')
      expect(result.jobId).toBe('ats:lever:abc123')
      expect(result.shortId).toBeNull()
    })
  })

  describe('v2.9 direct shortId format', () => {
    it('parses a bare shortId token', () => {
      const result = parseJobSlugParam('k8mub4')
      expect(result.shortId).toBe('k8mub4')
      expect(result.jobId).toBeNull()
    })
  })

  describe('opaque slug fallback', () => {
    it('returns roleSlug for unrecognized patterns', () => {
      const result = parseJobSlugParam('software-engineer-at-google')
      expect(result.roleSlug).toBe('software-engineer-at-google')
      expect(result.shortId).toBeNull()
      expect(result.jobId).toBeNull()
    })
  })
})
