// lib/jobs/languageRequirement.ts
//
// Which human languages a posting REQUIRES of the applicant ("Fluent German required"), as opposed to the language it is
// written in (lib/jobs/language.ts). A bare "mentions German" rule is wrong both ways: FTJA measured that dropping every
// posting that names another language would have lost 12 of 75 good jobs ("the German market", "German helps but isn't
// required"). So a language counts only when a sentence names it right next to a requirement cue ("fluent", "native",
// "must"...), carries no softening word ("plus", "nice to have"...), and is not an "X or <ignored language>" alternative.
// Anything ambiguous is left out. The heuristic is FTJA's (github.com/TaegyuJEONG/ftja, MIT: ftja/filter_stage0.py); this
// is an independent TypeScript version, see THIRD_PARTY_NOTICES.md.
//
// Each result carries the sentence it was read from, so a person (or a test) can check it. Pure.
import { plainPostingText, splitSentences } from './verifiedQuote'

/** ISO 639-1 code -> the English names a posting uses for the language. */
export const LANGUAGE_NAMES: Record<string, readonly string[]> = {
  en: ['English'], fr: ['French'], de: ['German'], nl: ['Dutch', 'Flemish'], it: ['Italian'], es: ['Spanish', 'Castilian'],
  pt: ['Portuguese'], pl: ['Polish'], cs: ['Czech'], sk: ['Slovak'], hr: ['Croatian'], sr: ['Serbian'],
  sl: ['Slovenian', 'Slovene'], sv: ['Swedish'], da: ['Danish'], no: ['Norwegian'], fi: ['Finnish'], el: ['Greek'],
  ro: ['Romanian'], hu: ['Hungarian'], bg: ['Bulgarian'], lt: ['Lithuanian'], lv: ['Latvian'], et: ['Estonian'],
  tr: ['Turkish'], uk: ['Ukrainian'], ru: ['Russian'], ca: ['Catalan'], he: ['Hebrew'], ar: ['Arabic'],
  ja: ['Japanese'], ko: ['Korean'], zh: ['Chinese', 'Mandarin', 'Cantonese'], hi: ['Hindi'],
}

export type LanguageRequirement = {
  code: string
  /** The name as the posting writes it ("German"). */
  language: string
  /** The sentence (or title) it was read from, verbatim. */
  sentence: string
}

const CUE = new RegExp(
  [
    'fluen(?:t|cy)',
    'proficien(?:t|cy)',
    // "AI-native", "cloud native" and "digital native" are not about a language.
    '(?<!AI[- ])(?<!cloud[- ])(?<!digital[- ])\\bnative\\b',
    'bilingual',
    'mother tongue',
    '\\bC[12]\\b',
    '(?:business|professional|working)[- ]level',
    'written and (?:spoken|verbal)',
    '(?:spoken|verbal) and written',
    '\\bspeakers?\\b',
    '\\bspeak\\b',
    'required',
    'requirement',
    '\\bmust\\b',
    'mandatory',
    'essential',
    'non-?negotiable',
    'command of',
  ].join('|'),
  'gi',
)

const SOFTENER = new RegExp(
  [
    '\\bplus\\b',
    'bonus',
    'nice[- ]to[- ]have',
    'advantage',
    'preferred',
    'preferably',
    'desirable',
    'desired',
    '\\basset\\b',
    'beneficial',
    'ideally',
    'appreciated',
    'welcome',
    '\\bhelps?\\b',
    'helpful',
    'optional',
    "n[o\\u2019']t (?:be )?(?:required|necessary|needed|mandatory|essential|expected|a must|something)",
  ].join('|'),
  'i',
)

/** "the Dutch accounting market" names a place to sell, not a language. */
const NOT_A_LANGUAGE_NOUN = 'markets?|sector|industry|customers?|clients?|users?|region|law|regulations?|legislation|compan(?:y|ies)|teams?|office|government|authorit(?:y|ies)|entity|subsidiary'

/** How far a cue may sit from the language name it applies to. */
const CUE_WINDOW = 40

function namesRegex(names: string[]): RegExp {
  return new RegExp(`\\b(?:${names.join('|')})\\b(?!(?: [\\w-]+){0,2} (?:${NOT_A_LANGUAGE_NOUN})\\b)`, 'g')
}

const CODE_BY_NAME = new Map(Object.entries(LANGUAGE_NAMES).flatMap(([code, names]) => names.map((n) => [n, code] as const)))

/**
 * The languages (other than `ignore`, default English) the posting requires, each with its sentence. Language names are
 * matched case-sensitively, so "polish the roadmap" is not Polish.
 */
export function findLanguageRequirements(
  posting: { title?: string | null; descriptionHtml?: string | null },
  ignore: readonly string[] = ['en'],
): LanguageRequirement[] {
  const ignored = new Set(ignore.map((c) => c.toLowerCase()))
  const wanted = Object.entries(LANGUAGE_NAMES).filter(([code]) => !ignored.has(code))
  if (!wanted.length) return []
  const otherNames = wanted.flatMap(([, names]) => [...names])
  const ignoredNames = Object.entries(LANGUAGE_NAMES).filter(([code]) => ignored.has(code)).flatMap(([, names]) => [...names])
  const other = namesRegex(otherNames)
  // "German or English" with English readable: the applicant qualifies with either.
  const alternative = ignoredNames.length
    ? new RegExp(`\\b(?:${ignoredNames.join('|')})\\b,? (?:and/)?or\\b|\\bor (?:${ignoredNames.join('|')})\\b|\\beither\\b`)
    : null

  const found = new Map<string, LanguageRequirement>()
  const add = (name: string, sentence: string) => {
    const code = CODE_BY_NAME.get(name)
    if (code && !found.has(code)) found.set(code, { code, language: name, sentence: sentence.trim() })
  }

  const title = String(posting.title ?? '').trim()
  const titleSpeaking = title.match(new RegExp(`\\b(${otherNames.join('|')})[- ][Ss]peak(?:ing|er)s?\\b`))
  if (titleSpeaking) add(titleSpeaking[1], title)

  const sentences = splitSentences(plainPostingText(posting.descriptionHtml)).flatMap((s) => s.split(';'))
  for (const sentence of sentences) {
    if (SOFTENER.test(sentence) || alternative?.test(sentence)) continue
    const cues = [...sentence.matchAll(CUE)].map((m) => [m.index!, m.index! + m[0].length] as const)
    if (!cues.length) continue
    for (const m of sentence.matchAll(other)) {
      const start = m.index!
      const end = start + m[0].length
      if (cues.some(([cueStart, cueEnd]) => cueEnd > start - CUE_WINDOW && cueStart < end + CUE_WINDOW)) add(m[0], sentence)
    }
  }
  return [...found.values()]
}
