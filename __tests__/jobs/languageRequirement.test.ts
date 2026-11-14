import { findLanguageRequirements } from '../../lib/jobs/languageRequirement'

const codes = (descriptionHtml: string, title?: string) =>
  findLanguageRequirements({ title, descriptionHtml }).map((r) => r.code)

describe('findLanguageRequirements', () => {
  it('finds a required language and returns its sentence', () => {
    const found = findLanguageRequirements({ descriptionHtml: '<p>Fluent German and English is required.</p>' })
    expect(found).toEqual([{ code: 'de', language: 'German', sentence: 'Fluent German and English is required.' }])
  })

  it('reads one requirement per list item', () => {
    expect(codes('<ul><li>Native French speaker</li><li>Must speak Dutch</li></ul>').sort()).toEqual(['fr', 'nl'])
  })

  it('ignores softened mentions', () => {
    expect(codes('<p>German is a plus.</p>')).toEqual([])
    expect(codes("<p>German helps but isn't required.</p>")).toEqual([])
    expect(codes('<p>Fluent French is nice to have.</p>')).toEqual([])
  })

  it('ignores a language that is a place to sell or a verb', () => {
    expect(codes('<p>You must understand the German market.</p>')).toEqual([])
    expect(codes('<p>You must polish the roadmap every quarter.</p>')).toEqual([])
  })

  it('does not treat "AI-native" as a language cue', () => {
    expect(codes('<p>We are an AI-native company with German customers.</p>')).toEqual([])
  })

  // Found on 1,482 real Lever postings (2026-11-14): these were flagged as requirements and are not.
  it('ignores "strong assets", "priority for" and "extra points", which are preferences', () => {
    expect(codes('<p>Bilingualism in French and English are considered strong assets.</p>')).toEqual([])
    expect(codes('<p>Priority for a candidate who speaks fluent German, regardless of location.</p>')).toEqual([])
    expect(codes('<p>You speak English fluently - extra points for fluent German!</p>')).toEqual([])
    expect(codes('<p>Fluent in English with German or Dutch as a secondary language.</p>')).toEqual([])
  })

  it('reads every language in "Spanish / Portuguese Speaking" in a title', () => {
    expect(codes('<p>Great team.</p>', 'Account Executive (Spanish / Portuguese Speaking)').sort()).toEqual(['es', 'pt'])
  })

  it('lets the candidate qualify with the ignored language', () => {
    expect(codes('<p>Fluent in German or English.</p>')).toEqual([])
    expect(codes('<p>Either German or English is required.</p>')).toEqual([])
  })

  it('reads "German-speaking" in the title', () => {
    expect(codes('<p>Great team.</p>', 'German-speaking Customer Success Manager')).toEqual(['de'])
  })

  it('does not report English by default but can be asked to', () => {
    expect(codes('<p>Fluent English is required.</p>')).toEqual([])
    expect(findLanguageRequirements({ descriptionHtml: '<p>Fluent English is required.</p>' }, []).map((r) => r.code)).toEqual(['en'])
  })

  it('needs the cue next to the language, not anywhere in a long sentence', () => {
    const far = '<p>Fluent communicators who enjoy working with product teams across many time zones and cultures, and who have also lived in Spain.</p>'
    expect(codes(far)).toEqual([])
  })
})
