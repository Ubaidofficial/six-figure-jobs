// lib/jobs/language.ts
//
// Which language a job description is written in, so the job page can mark it (`lang="es"`) and offer a translate
// link. Postings from European employers are kept in their original language; nothing is translated or stored.
//
// Method: share of words that are common function words of each language (no dependency, no database column). The word
// lists are chosen to be distinctive: words that mean different things in two supported languages ("die", "an", "as",
// "per", "en", "de") are left out. Returns null when the text is too short or no language clearly wins, and the page
// then treats it as English (no label, no button). Languages not listed here are never detected.

// 'other' is not a language code: it means the text is mostly in a non-Latin script (Cyrillic, Greek, Japanese...), which
// this module does not tell apart. Callers must not use it as a `lang` attribute.
export type JobLanguage = 'en' | 'es' | 'de' | 'fr' | 'nl' | 'it' | 'pt' | 'pl' | 'sv' | 'da' | 'no' | 'other'

type WordLanguage = Exclude<JobLanguage, 'other'>

const WORDS: Record<WordLanguage, string[]> = {
  en: [
    'the', 'and', 'of', 'to', 'with', 'for', 'you', 'your', 'will', 'our', 'are', 'we', 'is', 'be', 'have', 'that',
    'this', 'from', 'who', 'what', 'about', 'ability', 'experience', 'working', 'join', 'looking',
  ],
  es: [
    'el', 'los', 'las', 'una', 'para', 'con', 'por', 'que', 'del', 'su', 'sus', 'más', 'nuestro', 'nuestra', 'equipo',
    'experiencia', 'trabajo', 'empresa', 'años', 'será', 'tendrás', 'buscamos', 'conocimientos', 'requisitos',
    'funciones', 'somos',
  ],
  de: [
    'der', 'die', 'das', 'und', 'mit', 'für', 'von', 'den', 'dem', 'ein', 'eine', 'einen', 'ist', 'sind', 'wir', 'sie',
    'ihre', 'ihr', 'unser', 'unsere', 'bei', 'auf', 'oder', 'werden', 'du', 'dich', 'erfahrung', 'aufgaben',
    'kenntnisse', 'bewerbung', 'mitarbeiter',
  ],
  fr: [
    'le', 'les', 'des', 'du', 'et', 'pour', 'avec', 'une', 'dans', 'sur', 'nous', 'vous', 'votre', 'notre', 'est', 'sont',
    'au', 'aux', 'poste', 'équipe', 'expérience', 'entreprise', 'profil', 'missions', 'vos', 'ans',
  ],
  nl: [
    'het', 'een', 'van', 'voor', 'met', 'wij', 'je', 'jij', 'onze', 'ons', 'bij', 'naar', 'ook', 'zijn', 'wordt',
    'werken', 'ervaring', 'functie', 'bedrijf', 'jouw', 'deze', 'kennis', 'verantwoordelijkheden',
  ],
  it: [
    'il', 'gli', 'della', 'delle', 'dei', 'degli', 'nel', 'nella', 'sono', 'siamo', 'tuo', 'nostro', 'nostra',
    'esperienza', 'lavoro', 'azienda', 'ruolo', 'sarai', 'competenze', 'requisiti', 'ricerchiamo', 'anni',
    'di', 'che', 'alla', 'alle', 'dal', 'dalla', 'sul', 'sulla', 'anche', 'più', 'è', 'essere', 'nostri', 'nostre',
    'clienti', 'attività', 'vendita', 'opportunità',
  ],
  pt: [
    'os', 'uma', 'para', 'com', 'não', 'são', 'você', 'nós', 'nosso', 'nossa', 'experiência', 'trabalho', 'empresa',
    'equipa', 'equipe', 'vaga', 'requisitos', 'anos', 'será', 'também',
    'em', 'da', 'dos', 'das', 'ao', 'aos', 'seu', 'sua', 'pelo', 'pela', 'vendas', 'oportunidade', 'candidato',
  ],
  pl: [
    'oraz', 'się', 'jest', 'dla', 'nasz', 'naszym', 'pracy', 'doświadczenie', 'wymagania', 'oferujemy', 'zespole',
    'firmie', 'będziesz', 'jako', 'twoje', 'ponad',
  ],
  sv: [
    'och', 'att', 'som', 'för', 'med', 'är', 'vi', 'på', 'av', 'till', 'vår', 'vårt', 'erfarenhet', 'tjänsten', 'ett',
    'arbeta', 'ansök',
  ],
  da: ['og', 'ikke', 'vores', 'erfaring', 'stillingen', 'af', 'dig', 'jeres', 'jobbet', 'til', 'er', 'et', 'vi'],
  no: ['og', 'ikke', 'deg', 'vår', 'våre', 'erfaring', 'stillingen', 'å', 'som', 'til', 'er', 'et', 'vi', 'ditt'],
}

const SETS = Object.fromEntries(
  (Object.keys(WORDS) as WordLanguage[]).map((code) => [code, new Set(WORDS[code])]),
) as Record<WordLanguage, Set<string>>

export const JOB_LANGUAGE_NAMES: Record<JobLanguage, string> = {
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  nl: 'Dutch',
  it: 'Italian',
  pt: 'Portuguese',
  pl: 'Polish',
  sv: 'Swedish',
  da: 'Danish',
  no: 'Norwegian',
  other: 'another language',
}

const SIBLINGS: Partial<Record<WordLanguage, WordLanguage>> = { da: 'no', no: 'da' }

const SAMPLE_CHARS = 4000
const MIN_WORDS = 30
const MIN_LETTERS_FOR_SCRIPT = 80
const MIN_SHARE = 0.08
const MIN_LEAD = 1.6

function plainText(html: string): string {
  return html
    .slice(0, SAMPLE_CHARS * 4)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .slice(0, SAMPLE_CHARS)
}

/** The language of an HTML or plain-text description, or null when it is too short or not clearly one language. */
export function detectJobLanguage(html: string | null | undefined): JobLanguage | null {
  if (!html) return null
  const text = plainText(html)
  const letters = text.match(/\p{L}/gu) ?? []
  const nonLatin = letters.filter((c) => !/\p{Script=Latin}/u.test(c)).length
  if (letters.length >= MIN_LETTERS_FOR_SCRIPT && nonLatin / letters.length > 0.5) return 'other'

  const words = text.toLowerCase().match(/[\p{L}]+/gu) ?? []
  if (words.length < MIN_WORDS) return null

  const scores = (Object.keys(SETS) as WordLanguage[])
    .map((code) => ({ code, share: words.reduce((n, w) => n + (SETS[code].has(w) ? 1 : 0), 0) / words.length }))
    .sort((a, b) => b.share - a.share)

  const best = scores[0]
  if (best.share < MIN_SHARE) return null
  // Danish and Norwegian share most of their function words, so the lead is measured against the best language that
  // is not the sibling; the sibling only has to score lower (a tie is not a call).
  const sibling = SIBLINGS[best.code]
  if (sibling && scores.find((s) => s.code === sibling)!.share >= best.share) return null
  const rival = scores.find((s) => s.code !== best.code && s.code !== sibling)!
  if (rival.share > 0 && best.share < rival.share * MIN_LEAD) return null
  return best.code
}
