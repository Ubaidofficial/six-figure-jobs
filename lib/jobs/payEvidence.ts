// lib/jobs/payEvidence.ts
//
// A yearly pay range read from the posting's own sentences, for a job whose source gave no pay in its fields (pay
// transparency laws in several US states make employers print the range in the text). It answers only when it is sure,
// and always hands back the sentence it read, which is checked to be in the posting (verifyQuote). Tuned for precision:
// the range ends up in the salary gate, on the job card and in JobPosting `baseSalary`, so a wrong figure is worse than
// a missing one. The owner approved reading pay from description text on 2026-11-15 (see CLAUDE.md).
//
// What it reads: a range ("$150,000 - $180,000", "$150k to $190k", "USD 140,000-160,000", "£90,000 – £110,000") in a
// sentence that names pay ("salary", "base pay", "compensation", "pay range"...), stated per year or with no period at
// all and both ends at least 40,000. What it leaves alone: hourly, daily, weekly and monthly pay; bonuses, commission,
// equity, stipends, sign-on and relocation money; on-target earnings; a lone figure with no range; amounts that are
// company funding or revenue; a "$" with no sign of which dollar (see `dollar`).
//
// Several ranges (pay by location tier) are combined into one honest wide range: the lowest bottom and the highest top,
// so the salary gate judges the lowest tier. Different currencies in one posting: no answer.
//
// Pure: no database, no network.
import { plainPostingText, splitSentences, verifyQuote } from './verifiedQuote'

export type PayEvidence = {
  min: number
  max: number
  currency: 'USD' | 'CAD' | 'AUD' | 'GBP' | 'EUR' | 'CHF'
  period: 'year'
  /** The sentence(s) the range was read from, verbatim from the posting. */
  quote: string
}

export type PayContext = {
  /** freehire's lower-case country codes for the job, when known. */
  countries?: string[] | null
  location?: string | null
}

const PAY_WORDS =
  /\b(?:salary|salaries|base pay|base salary|base compensation|compensation|pay range|pay scale|pay band|salary range|annual (?:base|salary|pay|compensation)|annualized|target base|starting (?:base|salary|pay)|expected (?:base|salary|pay)|wage range|pay transparency)\b/i

// A sentence that says the figure is not a base salary: on-target earnings, total pay with commission, "earning
// potential", "top performers", or pay per visit/shift/project. Found on 34 real readings (2026-11-15): "estimated annual total
// compensation: $200,000 - $350,000+ (Including Base Salary, Commissions...)", "$200k-$300k OTE", "($100k-$150k+ Yearly
// Potential for Top Performers)", "$80 per routine visit, or an annual salary option of $100,000-$120,000".
const NOT_BASE_SALARY =
  /\b(?:on[- ]target|OTE|total (?:cash|compensation|earnings|comp)|earnings? potential|top performers?|uncapped|commissions? (?:are |is )?included|including[^.]{0,60}commission|per (?:routine |home |patient )?(?:visit|patient|case|shift|project|piece|mile|delivery|call))\b/i

// Money that is not the salary, when it sits just before the amount ("bonus of $10,000", "equity valued at $2M").
const NOT_SALARY_BEFORE =
  /(?:bonus|commission|stipend|sign[- ]?on|signing|referral|relocation|equity|stock|rsus?|options|grant|allowance|per diem|reimburs\w*|raised|funding|revenue|valuation|budget|invoice|up to|prizes?|cash prizes?|discount)\b[^.\n]{0,40}$/i

const CURRENCY_CODE = '(?:USD|CAD|AUD|GBP|EUR|CHF)'
const MONEY = `(?:(${CURRENCY_CODE})\\s?|(US\\$|C\\$|CA\\$|A\\$|AU\\$|\\$|£|€|CHF\\s?))?`
const NUMBER = '(\\d{1,3}(?:[,.\\s]\\d{3})+|\\d{2,6}(?:\\.\\d+)?\\s?[kK])'
// "A - B", "A to B", "A and B", "A – B" with an optional currency on each side.
const RANGE = new RegExp(`${MONEY}${NUMBER}\\s?(?:-|–|—|to|and)\\s?${MONEY}${NUMBER}`, 'gi')

function toAmount(raw: string): number {
  const s = raw.trim()
  if (/k$/i.test(s)) return Math.round(parseFloat(s) * 1000)
  return Number(s.replace(/[,.\s]/g, ''))
}

type Currency = PayEvidence['currency']

/** Which currency a range is in, or null when it cannot be told. A bare "$" is a US dollar only when nothing says otherwise. */
function currencyOf(codeA: string | undefined, symA: string | undefined, codeB: string | undefined, symB: string | undefined, sentence: string, ctx: PayContext): Currency | null {
  const code = (codeA || codeB || '').toUpperCase()
  if (code) return code as Currency
  const sym = (symA || symB || '').trim()
  if (sym === '£') return 'GBP'
  if (sym === '€') return 'EUR'
  if (/^CHF/i.test(sym)) return 'CHF'
  if (/^(?:C\$|CA\$)$/i.test(sym)) return 'CAD'
  if (/^(?:A\$|AU\$)$/i.test(sym)) return 'AUD'
  if (sym === 'US$') return 'USD'
  if (sym === '$') {
    if (/\bcanad(?:a|ian)\b|\bCAD\b/i.test(sentence)) return 'CAD'
    if (/\baustrali(?:a|an)\b|\bAUD\b/i.test(sentence)) return 'AUD'
    const countries = (ctx.countries ?? []).map((c) => c.toLowerCase())
    const location = (ctx.location ?? '').toLowerCase()
    if (countries.length === 1 && countries[0] === 'ca') return 'CAD'
    if (countries.length === 1 && countries[0] === 'au') return 'AUD'
    if (countries.length === 0 || countries.includes('us') || /\b(?:united states|usa|u\.s\.|remote)\b/.test(location) || /,\s?[A-Z]{2}\b/.test(ctx.location ?? '')) return 'USD'
    return null
  }
  return null
}

/** The pay range this posting states, with the sentence it came from; null when it states none it is sure about. */
export function readPayFromDescription(html: string | null | undefined, ctx: PayContext = {}): PayEvidence | null {
  const text = plainPostingText(html)
  if (!text) return null

  const found: Array<{ min: number; max: number; currency: Currency; sentence: string }> = []
  for (const sentence of splitSentences(text)) {
    if (!PAY_WORDS.test(sentence) || NOT_BASE_SALARY.test(sentence)) continue
    RANGE.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = RANGE.exec(sentence))) {
      const [whole, codeA, symA, numA, codeB, symB, numB] = m
      const before = sentence.slice(Math.max(0, m.index - 60), m.index)
      const after = sentence.slice(m.index + whole.length, m.index + whole.length + 40)
      if (NOT_SALARY_BEFORE.test(before)) continue
      // Hourly, daily, weekly and monthly pay are not read.
      if (/^\s*(?:\/|per\s|an?\s|each\s)?(?:hour|hr|day|week|wk|month|mo\b|diem)/i.test(after)) continue
      if (/^\s*(?:\/|per\s)?h\b/i.test(after)) continue
      const min = toAmount(numA)
      const max = toAmount(numB)
      if (!(min >= 40_000 && max >= min && max <= 2_000_000 && max <= min * 3)) continue
      const currency = currencyOf(codeA, symA, codeB, symB, sentence, ctx)
      if (!currency) continue
      found.push({ min, max, currency, sentence })
    }
  }
  if (found.length === 0) return null
  if (new Set(found.map((f) => f.currency)).size > 1) return null

  const min = Math.min(...found.map((f) => f.min))
  const max = Math.max(...found.map((f) => f.max))
  const quotes = [...new Set(found.map((f) => f.sentence))].slice(0, 2)
  const quote = quotes.join(' ')
  if (!verifyQuote(quote.split(' ').length > 1 ? quotes.join(' ... ') : quote, text)) return null
  return { min, max, currency: found[0].currency, period: 'year', quote }
}
