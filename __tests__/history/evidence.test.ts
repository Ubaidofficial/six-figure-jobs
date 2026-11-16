import { benefitEvidenceRecords, remoteEvidenceRecord } from '../../lib/history/evidence'
import { BENEFITS_EVIDENCE_VERSION, readBenefitsEvidence } from '../../lib/jobs/benefitsEvidence'
import { findRemoteEvidence, REMOTE_EVIDENCE_VERSION } from '../../lib/jobs/remoteEvidence'

// Output of the real readers on this posting: one benefit (a 401(k) match) and the remote mode, each with its sentence.
const html =
  '<p>About the team. We build payment systems.</p><h3>Benefits</h3><ul><li>Unlimited PTO</li><li>401(k) with a 4% company match</li><li>25 days paid time off</li></ul>' +
  '<p>This is a fully remote role open to candidates across the US.</p>'
const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')

describe('benefitEvidenceRecords', () => {
  it('stores each benefit as the label that goes in benefitsJson, with its sentence, reader and version', () => {
    const benefits = readBenefitsEvidence(html)
    expect(benefits.length).toBeGreaterThan(0)
    const records = benefitEvidenceRecords('job-1', benefits)
    expect(records).toHaveLength(benefits.length)
    for (const [i, r] of records.entries()) {
      expect(r).toEqual({ jobId: 'job-1', field: 'benefits', value: benefits[i].label, quote: benefits[i].quote, extractor: 'benefitsEvidence', extractorVersion: BENEFITS_EVIDENCE_VERSION })
      expect(plain).toContain(r.quote) // the sentence really is in the posting
    }
  })

  it('makes nothing from no benefits', () => {
    expect(benefitEvidenceRecords('job-1', [])).toEqual([])
  })
})

describe('remoteEvidenceRecord', () => {
  it('stores the mode that goes in remoteMode with the sentence that says so', () => {
    const found = findRemoteEvidence(html)
    expect(found).not.toBeNull()
    const r = remoteEvidenceRecord('job-2', found!)
    expect(r).toEqual({ jobId: 'job-2', field: 'remoteMode', value: 'remote', quote: found!.quote, extractor: 'remoteEvidence', extractorVersion: REMOTE_EVIDENCE_VERSION })
    expect(plain).toContain(r.quote)
  })
})

describe('reader versions', () => {
  it('are whole numbers from 1, so a change can be told from the first reading', () => {
    for (const v of [BENEFITS_EVIDENCE_VERSION, REMOTE_EVIDENCE_VERSION]) expect(Number.isInteger(v) && v >= 1).toBe(true)
  })
})
