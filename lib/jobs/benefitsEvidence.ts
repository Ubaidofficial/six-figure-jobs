// lib/jobs/benefitsEvidence.ts
//
// Time off and benefits read from the posting's own sentences, each with the sentence it came from, checked to be in the
// posting (verifyQuote). Same pattern as payEvidence.ts and remoteEvidence.ts, tuned for precision: a missed benefit is
// fine, a wrong one is not. What it answers:
//   unlimited / open PTO; a stated number of days or weeks of paid time off ("25 days paid time off"); paid parental /
//   maternity / paternity leave (only when the posting says "paid" or gives weeks); 401(k); pension; health insurance
//   (only when the employer offers it); a four-day / 32-hour / compressed week (only as the company's policy); a
//   learning / professional development budget; equity / stock options.
//
// What it leaves alone: a sentence that negates ("no unlimited PTO", "we do not offer 401(k)"), is a requirement ("must
// be able to...", "candidates must have their own health insurance"), is conditional, hedged or in the past ("if you...",
// "may include", "after 3 years", "we used to offer"), is legal / EEO boilerplate, or is about a customer's benefits
// ("pension fund clients", "health insurance industry"). A leave range ("15-20 days"), "up to 25 days", "25+ days", a
// number that is not leave ("25 days notice") or a rate ("2 days per month") gives no number. Two different day counts in
// one posting give none.
//
// Pure: no database, no network. Writes nothing; scripts/backfillBenefitsEvidence.ts stores labels on EMPTY benefitsJson.
import { plainPostingText, splitSentences, verifyQuote } from './verifiedQuote'

export type BenefitEvidence = {
  category: BenefitCategory
  /** Short label for the job page, e.g. "25 days paid time off", "401(k) match". */
  label: string
  /** The sentence it was read from, verbatim from the posting (a benefits heading + "..." + the line when the line is very short). */
  quote: string
}

/** Stored with each quote-backed value (lib/history/evidence.ts). Raise it whenever a rule below changes what the reader finds. */
export const BENEFITS_EVIDENCE_VERSION = 1

export type BenefitCategory = 'pto' | 'parental' | 'health' | 'k401' | 'pension' | 'equity' | 'learning' | 'fourDay'

const MAX_ITEMS = 12

// ---- sentence-level filters: a sentence that trips one of these is not read at all ----------------------------------

const LEGAL =
  /\b(?:equal opportunity|equal employment|EEO|affirmative action|protected (?:class|veteran|status)|without regard to|reasonable accommodations?|discriminat\w*|e-?verify|privacy (?:notice|policy)|background checks?|drug[- ]free|applicable laws?|by law|legally|statutory|veteran status|gender identity|sexual orientation|national origin|ADA|FMLA|ERISA|COBRA|HIPAA|GDPR|CCPA)\b/

// "must be able to...", "candidates must have their own health insurance", "experience with 401(k) plans".
const REQUIREMENT =
  /\b(?:must|required|requires?|requirements?|need(?:s|ed)? to|should|have to|has to|ability to|able to|expected to|responsible for|experience (?:with|in|of|using)|knowledge of|familiar(?:ity)? with|proficien\w+|background in|preferred|nice to have|bonus points|qualifications?|your own|own (?:health|medical|insurance|benefits)|independent contractors?|contractors?|1099|not eligible|ineligible)\b/i

const NEGATION_EXEMPT =
  /\b(?:at|for|with|of) no (?:additional |extra |added )?(?:cost|charge|fee)\b|\bno[- ]cost\b|\bnot only\b|\bnot just\b|\bno waiting period\b|\bno questions asked\b|\bno strings\b|\bno matter\b/gi
const NEGATION =
  /\b(?:no|not|never|none|without|neither|nor|cannot|can['’]?t|won['’]?t|don['’]?t|doesn['’]?t|isn['’]?t|aren['’]?t|wasn['’]?t|unpaid|unable|exclud\w+|except|lack(?:s|ing)?|limited)\b|n['’]t\b/i

// "if you...", "after 90 days", "may include", "some roles", "we used to", "exploring a four-day week".
const CONDITIONAL =
  /\b(?:if|when|whenever|unless|once|after|until|upon|were|was|used to|previously|formerly|had|may|might|could|would|potentially|possibly|depending|dependent|subject to|varies|vary|some|certain|select|most|many|several|plan(?:s|ning)? to|looking to|working (?:on|towards?)|aim\w*|exploring|considering|pilot|trial|future|soon|upcoming|eventually|hope)\b/i

// What a customer's or the market's benefits look like in a sentence, not this employer's.
const NOT_OURS =
  /\b(?:clients?|customers?|patients|investors|advis[oe]rs|shareholders|employers|retirees|plan (?:members|participants|sponsors)|platform|software|marketplace|insurtech|saas)\b|\bhealth insurance (?:compan(?:y|ies)|carriers?|industry|market|space|sector|brokers?|agents?|exchange)\b|\binsurance (?:industry|experience|carriers?|agents?|brokers?)\b/i

// Someone who runs the program rather than receives it ("manage the training budget", "equity compensation administration").
const RUNS_IT = /\b(?:manage[sd]?|administer\w*|administration|design\w*|analy[sz]\w*|advis\w*|process\w*|own(?:s|ed|ing)?|oversee\w*|report\w*|accounting|valuation|409a|cap table|payroll)\b/i

// The employer is the one giving it: "we offer", "our benefits include", "company-paid", a "Benefits:" label.
const OFFER_CUE = new RegExp(
  [
    "\\b(?:we|company|employer|you|you(?:['’]ll| will)|employees|team members|everyone)\\b[^.]{0,50}\\b(?:offer(?:s|ing)?|provide[sd]?|cover(?:s|ed)?|contribut\\w+|match(?:es)?|sponsor\\w*|receive|get|enjoy|have access|pay(?:s)? for|paid for|give|grant)\\b",
    '\\b(?:benefits?|perks|package|compensation|rewards)\\b[^.]{0,30}\\b(?:includes?|including|offered)\\b',
    '\\b(?:benefits?|perks)\\s*:',
    '\\b(?:employer|company)[- ](?:paid|sponsored|provided|funded|matched|subsidi[sz]ed)\\b',
    '\\b(?:comprehensive|competitive|generous|great|excellent|full) (?:benefits?|package)\\b',
    "\\bwe(?:['’]re| are) (?:proud|happy|pleased|excited) to\\b",
    '\\bour benefits\\b',
  ].join('|'),
  'i',
)

// ---- sections: a bullet like "Medical, dental and vision" says nothing alone, but under a "Benefits" heading it does ----

const BENEFITS_HEADING =
  /^(?:(?:our|company|employee|your|the)\s+)?(?:benefits?(?:\s*(?:&|and)\s*perks)?|perks(?:\s*(?:&|and)\s*benefits?)?|what we offer|what we(?:['’]re| are) offering|total rewards|what you(?:['’]ll| will) get|what(?:['’]s| is) in it for you|we offer|compensation\s*(?:&|and)\s*benefits|benefits package)\b[\s\w&,'’-]{0,30}:?$/i
const OTHER_HEADING =
  /\b(?:about|who (?:you|we)|what you(?:['’]ll| will)? (?:do|bring|need|have)|responsibilities|requirements|qualifications|the role|your role|job description|skills|how to apply|equal opportunity|diversity|our (?:mission|values|story|culture|team)|the team|overview|apply|location)\b/i
const LEGAL_HEADING =
  /^(?:equal (?:opportunity|employment)|eeo|eoe|accommodations?|privacy (?:notice|policy)|legal (?:notice|disclaimer)|notice to|applicant privacy|ccpa|gdpr|diversity,? equity|our commitment to diversity)\b/i
const SECTION_MAX_LINES = 25

function isHeadingLine(line: string): boolean {
  return line.length <= 60 && !/[.!?,;]$/.test(line)
}

// ---- numbers of days of leave --------------------------------------------------------------------------------------

const WORD_NUMBER: Record<string, number> = { two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, twelve: 12, fifteen: 15, twenty: 20, 'twenty-five': 25, thirty: 30 }
const NUM = '(\\d{1,2}|two|three|four|five|six|seven|eight|ten|twelve|fifteen|twenty(?:[- ]five)?|thirty)'
const LEAVE_NOUN = '(paid time off|paid vacation|annual vacation|annual leave|annual holiday|pto|vacation)'

const toNumber = (raw: string): number => {
  const s = raw.toLowerCase().replace(' ', '-')
  return WORD_NUMBER[s] ?? Number(s)
}

// "25 days paid time off", "5 weeks of vacation", "25 days of annual leave" | "25 vacation days" | "PTO: 25 days", "vacation of 3 weeks"
const LEAVE_A = new RegExp(`(?<![\\d.,$£€])${NUM}[- ](days?|weeks?)\\s+(?:of\\s+)?${LEAVE_NOUN}\\b`, 'gi')
const LEAVE_B = new RegExp(`(?<![\\d.,$£€])${NUM}\\s+(?:paid\\s+)?(vacation|pto|annual leave)\\s+(days?)\\b`, 'gi')
const LEAVE_C = new RegExp(`\\b${LEAVE_NOUN}(?:\\s+(?:allowance|entitlement))?\\s*(?:of|:|–|-|—|\\(|is)\\s*${NUM}[- ](days?|weeks?)\\b`, 'gi')

// A number that is a range, a floor or a ceiling, not a stated amount.
const NOT_A_FIGURE_BEFORE =
  /(?:\d\s*(?:-|–|—|to|or|and|\/)\s*|up to\s+|at least\s+|minimum(?: of)?\s+|min\.?\s+|from\s+|starting(?: at| with)?\s+|over\s+|more than\s+|around\s+|about\s+|approximately\s+|~\s*|\+\s*)$/i
const A_RATE_AFTER = /^\s*(?:\/\s*(?:mo|month|quarter)\b|(?:per|a|each|every)\s+(?:month|quarter|week|pay period)\b)/i
// Leave that is not general PTO, or that depends on service.
const NOT_GENERAL_LEAVE =
  /\b(?:volunteer\w*|sick|parental|maternity|paternity|adoption|bereavement|jury|birthday|shutdown|closure|wedding|moving|family|caregiver|military|disability|wellness|mental|sabbatical|summer|winter|floating|personal days?|tenure|seniority|years? of service|first year|for every|increas\w+|grows?)\b/i

function clauseAround(sentence: string, at: number): string {
  let start = 0
  let end = sentence.length
  const re = /[;,]|\s(?:and|plus|&|but)\s/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(sentence))) {
    if (m.index < at) start = m.index + m[0].length
    else {
      end = m.index
      break
    }
  }
  return sentence.slice(start, end)
}

function leaveNoun(raw: string): string {
  const n = raw.toLowerCase()
  if (n === 'pto' || n === 'paid time off') return 'paid time off'
  if (n === 'paid vacation') return 'paid vacation'
  if (n.includes('vacation')) return 'vacation'
  return 'annual leave'
}

/** "25 days paid time off" for a sentence that states one clear figure; null when it states none or says several. */
function readLeaveDays(sentence: string): string | null {
  const labels = new Set<string>()
  const read = (re: RegExp, pick: (m: RegExpExecArray) => { n: string; unit: string; noun: string }) => {
    re.lastIndex = 0
    let m: RegExpExecArray | null
    while ((m = re.exec(sentence))) {
      const { n, unit, noun } = pick(m)
      const number = toNumber(n)
      const weeks = /^w/i.test(unit)
      if (!(weeks ? number >= 2 && number <= 8 : number >= 10 && number <= 45)) continue
      if (NOT_A_FIGURE_BEFORE.test(sentence.slice(Math.max(0, m.index - 20), m.index))) continue
      if (A_RATE_AFTER.test(sentence.slice(m.index + m[0].length, m.index + m[0].length + 25))) continue
      if (NOT_GENERAL_LEAVE.test(clauseAround(sentence, m.index))) continue
      labels.add(`${number} ${weeks ? 'weeks' : 'days'} ${leaveNoun(noun)}`)
    }
  }
  read(LEAVE_A, (m) => ({ n: m[1], unit: m[2], noun: m[3] }))
  read(LEAVE_B, (m) => ({ n: m[1], unit: m[3], noun: m[2] }))
  read(LEAVE_C, (m) => ({ n: m[2], unit: m[3], noun: m[1] }))
  return labels.size === 1 ? [...labels][0] : null
}

// ---- the categories ------------------------------------------------------------------------------------------------

const UNLIMITED_PTO =
  /\b(?:unlimited|open)\s+(?:pto|paid time off|paid vacation|vacation(?: days| policy)?|time[- ]off|paid leave|annual leave)\b|\b(?:pto|paid time off|vacation|time off)(?: policy)?\s+(?:is|are)\s+unlimited\b|\bas much (?:paid )?(?:time off|vacation|pto) as you need\b/i

const KIND = '(parental|maternity|paternity|family|adoption)'
const PARENTAL_PAID = new RegExp(`\\bpaid\\s+${KIND}(?:\\s*(?:,|and|&|/|or)\\s*${KIND})?\\s+leave\\b`, 'i')
const PARENTAL_IS_PAID = new RegExp(`\\b${KIND}\\s+leave\\b(?:\\s+(?:is|are|will be|that is|which is))?\\s*\\(?\\s*(?:fully\\s+|100\\s?%\\s+)?paid\\b`, 'i')
const PARENTAL_WEEKS_A = new RegExp(`(?<![\\d.])${NUM}[- ]weeks?(?:['’]s)?\\s+(?:of\\s+)?(?:(?:fully|100\\s?%)\\s+)?(paid\\s+)?${KIND}\\s+leave\\b`, 'i')
const PARENTAL_WEEKS_B = new RegExp(`\\b${KIND}\\s+leave\\s*(?:of|:|–|-|—|\\()\\s*${NUM}[- ]weeks?\\b`, 'i')
const PARENTAL_NOT_LAW = /\b(?:as required|required by|in accordance|in compliance|comply|complies|where (?:required|applicable)|mandated|local law|federal|state)\b/i

// "health insurance enrollment forms", "health benefits administration" are work to do, not a benefit to receive.
const HEALTH =
  /\b(?:medical|health|dental|vision)\b[^.]{0,30}\b(?:insurance|coverage|plans?|benefits)\b(?!\s+(?:enrol\w+|forms?|claims?|processing|administration|billing|verification|eligibility|navigation|data|products?|polic(?:y|ies)))|\b(?:medical|health)\s*,\s*(?:dental|vision)\b|\bdental\s*(?:,|and|&)\s*vision\b/i

const K401 = /\b401\s?\(?k\)?/i

const PENSION = /\bpensions?\b/i
const PENSION_NOT_OURS =
  /\bpensions? (?:funds?|administrat\w*|industry|sector|market|consultan\w*|actuar\w*|trustees?|providers?|liabilit\w*|risk|assets|savers)\b|\bstate pensions?\b/i

const FOUR_DAY =
  /\b(?:four|4)[- ]day (?:work ?)?(?:week|workweek)\b|\b32[- ]hour (?:work ?)?(?:week|workweek)\b|\b(?:compressed|condensed) (?:work ?)?(?:week|workweek|working week)\b/i
const FOUR_DAY_CUE = /\b(?:we|our|company|everyone|all (?:employees|team members))\b[^.]{0,50}\b(?:operate|run|work|follow|adopt\w*|practice|have|embrace|moved|switched)\b/i

const LEARNING = new RegExp(
  [
    '\\b(?:learning|professional[- ]development|personal[- ]development|career[- ]development|education(?:al)?|training|conference|books?|courses?|skills? development)\\s*(?:&|and|/|,)?\\s*(?:\\w+\\s)?(?:budget|stipend|allowance|fund|funds|credits?|reimbursement)\\b',
    '\\b(?:budget|stipend|allowance|fund)\\s+(?:for|towards?)\\s+(?:your\\s+|own\\s+)?(?:learning|professional development|personal development|courses?|books?|conferences?|training|education|skills)\\b',
  ].join('|'),
  'i',
)

const EQUITY =
  /\b(?:equity (?:grants?|packages?|compensation|awards?|ownership|stake|participation|options?|incentives?|plan)|stock (?:options?|grants?|awards?|purchase plan|compensation)|employee stock|ESPP|RSUs?|restricted stock|ESOP|share options?|share (?:option )?scheme|(?:meaningful|significant|competitive|early|generous|startup)[- ](?:stage )?equity|(?:salary|compensation|pay|cash|base|bonus|benefits?)\s*(?:,|\+|and|&|plus)\s*(?:\w+\s)?equity|equity\s*(?:,|\+|and|&)\s*(?:benefits?|bonus|salary))\b/i
// "diversity, equity and inclusion", "private equity", "equity research", "home equity" are not a benefit.
const EQUITY_NOT_A_BENEFIT =
  /\b(?:diversity|inclusion|inclusive|belonging|racial|gender|pay equity|home equity|private equity|equity (?:research|markets?|trading|capital|analysts?|funds?|firm|investments?|derivatives|financing|release|partners?|sales|desk|portfolio)|venture|brand equity|health equity|social equity|educational equity|equitable)\b/i

type Reading = { category: BenefitCategory; label: string }

/** What one (already filtered) sentence says, as zero or more readings. `listed` is true under a "Benefits" heading. */
function readSentence(sentence: string, listed: boolean): Reading[] {
  const out: Reading[] = []
  const offered = listed || OFFER_CUE.test(sentence)
  const ours = !NOT_OURS.test(sentence)

  if (UNLIMITED_PTO.test(sentence)) out.push({ category: 'pto', label: 'Unlimited PTO' })
  else {
    const days = readLeaveDays(sentence)
    if (days) out.push({ category: 'pto', label: days })
  }

  if (!PARENTAL_NOT_LAW.test(sentence)) {
    const paid = sentence.match(PARENTAL_PAID)
    const isPaid = sentence.match(PARENTAL_IS_PAID)
    const weeksA = sentence.match(PARENTAL_WEEKS_A)
    const weeksB = sentence.match(PARENTAL_WEEKS_B)
    const partial = paid && /(?:partial(?:ly)?|part)[- ]$/i.test(sentence.slice(Math.max(0, paid.index! - 10), paid.index))
    if ((paid && !partial) || isPaid || weeksA || weeksB) {
      const kindsFound = [paid?.[1], paid?.[2], isPaid?.[1], weeksA?.[3], weeksB?.[1]].filter(Boolean).map((k) => k!.toLowerCase())
      const kind = new Set(kindsFound).size > 1 ? 'parental' : kindsFound[0] === 'adoption' ? 'adoption' : kindsFound[0]
      const weeksAt = weeksA ?? weeksB
      const weeks = weeksAt ? toNumber(weeksA ? weeksA[1] : weeksB![2]) : 0
      const weeksOk = weeks >= 4 && weeks <= 52 && !NOT_A_FIGURE_BEFORE.test(sentence.slice(Math.max(0, weeksAt!.index! - 20), weeksAt!.index))
      const saysPaid = Boolean((paid && !partial) || isPaid || weeksA?.[2])
      if (saysPaid) out.push({ category: 'parental', label: weeksOk ? `${weeks} weeks paid ${kind} leave` : `Paid ${kind} leave` })
      else if (weeksOk) out.push({ category: 'parental', label: `${weeks} weeks ${kind} leave` })
    }
  }

  if (K401.test(sentence) && ours && offered) {
    const match = /\b(?:employer|company|we)\b[^.]{0,30}\bmatch|401\s?\(?k\)?[^.]{0,30}\bmatch|\bmatch\w*[^.]{0,30}401/i.test(sentence)
    out.push({ category: 'k401', label: match ? '401(k) match' : '401(k)' })
  }

  if (PENSION.test(sentence) && ours && offered && !PENSION_NOT_OURS.test(sentence)) {
    const contribution = /\b(?:employer|company)\s+(?:pension\s+)?contribut|\bpension\s+(?:contributions?|match)|contribut\w+\s+(?:to|into)\s+(?:your|a)\s+pension/i.test(sentence)
    out.push({ category: 'pension', label: contribution ? 'Employer pension contribution' : 'Pension' })
  }

  if (HEALTH.test(sentence) && ours && offered) out.push({ category: 'health', label: 'Health insurance' })

  if (FOUR_DAY.test(sentence) && ours && (offered || FOUR_DAY_CUE.test(sentence))) {
    const label = /32/.test(sentence.match(FOUR_DAY)![0]) ? '32-hour work week' : /compressed|condensed/i.test(sentence.match(FOUR_DAY)![0]) ? 'Compressed work week' : 'Four-day work week'
    out.push({ category: 'fourDay', label })
  }

  if (LEARNING.test(sentence) && ours && offered && !RUNS_IT.test(sentence)) out.push({ category: 'learning', label: 'Learning budget' })

  if (EQUITY.test(sentence) && ours && !EQUITY_NOT_A_BENEFIT.test(sentence) && !RUNS_IT.test(sentence)) {
    // "salary + equity" says it by itself; a bare mention such as "equity grants" needs an employer giving it.
    const compound = /(?:salary|compensation|pay|cash|base|bonus|benefits?)\s*(?:,|\+|and|&|plus)\s*(?:\w+\s)?equity|(?:meaningful|significant|competitive|generous)[- ]equity/i.test(sentence)
    if (offered || compound) out.push({ category: 'equity', label: /\bstock options?\b/i.test(sentence) ? 'Stock options' : 'Equity' })
  }

  return out
}

const CATEGORY_ORDER: BenefitCategory[] = ['pto', 'parental', 'health', 'k401', 'pension', 'equity', 'learning', 'fourDay']

/**
 * The time off and benefits this posting states, each with its sentence; empty when it states none it is sure about.
 * At most 12, no repeated labels. `text` may be plain text or the posting's HTML.
 */
export function readBenefitsEvidence(text: string | null | undefined): BenefitEvidence[] {
  const plain = plainPostingText(text)
  if (!plain) return []

  const found: Array<Reading & { quote: string }> = []
  let heading: string | null = null
  let linesLeft = 0
  let inLegal = false

  for (const line of plain.split('\n')) {
    if (isHeadingLine(line)) {
      if (BENEFITS_HEADING.test(line)) {
        heading = line
        linesLeft = SECTION_MAX_LINES
        inLegal = false
        continue
      }
      if (LEGAL_HEADING.test(line)) inLegal = true
      if (OTHER_HEADING.test(line)) linesLeft = 0
    }
    if (inLegal) continue
    const listed = linesLeft-- > 0

    for (const sentence of splitSentences(line)) {
      if (sentence.endsWith('?') || LEGAL.test(sentence) || REQUIREMENT.test(sentence)) continue
      if (NEGATION.test(sentence.replace(NEGATION_EXEMPT, ' ')) || CONDITIONAL.test(sentence)) continue
      for (const reading of readSentence(sentence, listed)) {
        const quote = listed && heading && sentence.length < 30 ? `${heading} ... ${sentence}` : sentence
        found.push({ ...reading, quote })
      }
    }
  }

  const out: BenefitEvidence[] = []
  for (const category of CATEGORY_ORDER) {
    let readings = found.filter((f) => f.category === category)
    if (category === 'pto') {
      // Unlimited next to a number is a contradiction we do not resolve; two different numbers likewise.
      const unlimited = readings.filter((r) => r.label === 'Unlimited PTO')
      const numbered = readings.filter((r) => r.label !== 'Unlimited PTO')
      if (unlimited.length && numbered.length) readings = []
      else if (new Set(numbered.map((r) => r.label)).size > 1) readings = []
    }
    for (const r of readings) {
      if (!verifyQuote(r.quote, plain)) continue
      out.push({ category, label: r.label, quote: r.quote })
      break // one label per category
    }
  }
  return out.slice(0, MAX_ITEMS)
}
