// lib/jobs/jobSummary.ts
// A short summary of the role and the benefits a posting names, read from the posting's own description.
//
// Job rows and cards used only the AI-written snippet, and AI enrichment is paused (0.4% of live jobs had one on
// 2026-11-10), so almost every row opened to nothing. This reads the description itself: the role section when the
// posting has one ("About the role", "The opportunity", "What you'll do"...), otherwise the first sentences that are
// about the job rather than the company. Benefits are named only when the posting states them.

type Block = { text: string; heading: boolean }

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'" }

function decode(s: string): string {
  return s
    .replace(/&(nbsp|amp|lt|gt|quot|apos|#39);/g, (_, k: string) => ENTITIES[k] ?? ' ')
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCharCode(parseInt(n, 16)))
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()

/** Paragraphs, list items and headings as plain text, in order. Escaped HTML is decoded first. */
export function descriptionBlocks(html: string): Block[] {
  let s = decode(html || '')
  if (!/<[a-z][\s\S]*>/i.test(s)) {
    return s.split(/\n{2,}|\r\n\r\n/).map((t) => ({ text: clean(t), heading: false })).filter((b) => b.text)
  }
  s = s.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
  const blocks: Block[] = []
  // Each block-level element becomes one block; <h*> and fully-bold short paragraphs are headings.
  const parts = s.split(/<\/?(?:p|div|li|ul|ol|h[1-6]|br|section|article|tr|blockquote)\b[^>]*>/i)
  const tags = s.match(/<\/?(?:p|div|li|ul|ol|h[1-6]|br|section|article|tr|blockquote)\b[^>]*>/gi) ?? []
  for (let i = 0; i < parts.length; i++) {
    const raw = parts[i]
    const text = clean(raw.replace(/<[^>]+>/g, ' '))
    if (!text) continue
    const opener = (tags[i - 1] ?? '').toLowerCase()
    const allBold = /^\s*<(strong|b)\b[^>]*>[\s\S]*<\/\1>\s*$/i.test(raw)
    const heading =
      text.length <= 80 && (/^<h[1-6]/.test(opener) || allBold || /:$/.test(text) || (/^[^a-z]+$/.test(text) && /[A-Z]{3}/.test(text)))
    blocks.push({ text, heading })
  }
  return blocks
}

const ROLE_HEADING =
  /^(about (the|this) (role|position|job|opportunity|team)|the role|role|your role|the opportunity|opportunity|the position|position|overview|role (overview|summary|description)|position (overview|summary|description)|job (summary|description|overview)|summary|what you('|’)ll (do|be doing|work on)|what you will (do|be doing)|in this role|the job|responsibilities|key responsibilities|the team|about the team)\b/i
const COMPANY_HEADING = /^(about (us|the company)|about [^:]{2,40}$|who we are|our (mission|story|company)|company (overview|description)|the company|why (join|work)|life at)/i
const OTHER_HEADING =
  /^(benefits|perks|what we offer|compensation|salary|pay|requirements|qualifications|what you('|’)ll bring|what we('|’)re looking for|you (have|bring|might be)|nice to have|bonus|preferred|equal opportunity|eeo|location|how to apply|our (benefits|values))/i

/** True for a sentence about the company rather than the job ("Acme is a…", "Founded in…", "We're backed by…"). */
export function isCompanyBio(sentence: string, company?: string | null): boolean {
  const t = sentence.toLowerCase()
  if (/\b(you|you'll|you’ll|your)\b/.test(t) && !/\bwe('re| are) (a|an|the)\b/.test(t)) return false
  if (/\b(is|are) (seeking|hiring|looking for)\b/.test(t)) return false
  if (company && t.startsWith(company.toLowerCase())) return true
  return /\b(founded|our mission|we believe|backed by|raised \$|series [a-f]\b|headquartered|unicorn|valuation|investors|customers (include|like)|trusted by|we('re| are) (a|an|the|building|on a mission|growing)|is (a|an|the) (leading|global|fast|venture|world)|powers|pioneer|industry leader|fortune 500|nyse|nasdaq)\b/.test(
    t,
  )
}

const ROLE_CUE = /\b(you('ll| will)|you’ll|we('re| are) (looking|seeking|hiring)|we’re (looking|seeking|hiring)|this role|the role|as (a|an|the) |in this position|will be responsible|you will|responsible for|join (our|the) .{0,40}team|seeking (a|an)|looking for (a|an))\b/i

function sentences(text: string): string[] {
  // A list item or heading-less line without its own full stop still ends a sentence.
  if (!/[.!?…:;]$/.test(text)) text = `${text}.`
  return text.split(/(?<=[.!?])\s+(?=[A-Z“"(])/).map(clean).filter(Boolean)
}

function clip(parts: string[], max: number): string | null {
  let out = ''
  for (const s of parts) {
    const next = out ? `${out} ${s}` : s
    if (next.length > max) {
      if (!out) out = `${s.slice(0, max - 1).replace(/\s+\S*$/, '')}…`
      break
    }
    out = next
  }
  return out.length >= 40 ? out : null
}

/** One or two sentences on what the job is, at most `max` characters, or null when the description has none. */
export function summarizeRole(html: string | null | undefined, opts: { company?: string | null; max?: number } = {}): string | null {
  const max = opts.max ?? 280
  const blocks = descriptionBlocks(html ?? '')
  if (!blocks.length) return null

  // 1. The text under a role heading.
  for (let i = 0; i < blocks.length; i++) {
    if (!blocks[i].heading || !ROLE_HEADING.test(blocks[i].text.replace(/[:\s]+$/, ''))) continue
    const body: string[] = []
    for (let j = i + 1; j < blocks.length && !blocks[j].heading && body.join(' ').length < max; j++) {
      body.push(...sentences(blocks[j].text).filter((s) => !isCompanyBio(s, opts.company)))
    }
    const out = clip(body.filter((s) => s.length > 20), max)
    if (out) return out
  }

  // 2. Otherwise the first job-related sentences, outside company / benefits / requirements sections.
  let section: 'role' | 'company' | 'other' = 'role'
  const candidates: string[] = []
  for (const b of blocks) {
    if (b.heading) {
      const h = b.text.replace(/[:\s]+$/, '')
      section = ROLE_HEADING.test(h) ? 'role' : COMPANY_HEADING.test(h) ? 'company' : OTHER_HEADING.test(h) ? 'other' : section
      continue
    }
    if (section !== 'role') continue
    for (const s of sentences(b.text)) if (s.length > 30 && !isCompanyBio(s, opts.company)) candidates.push(s)
    if (candidates.length >= 6) break
  }
  const cued = candidates.findIndex((s) => ROLE_CUE.test(s))
  return clip(cued > 0 ? candidates.slice(cued) : candidates, max)
}

// Benefits: label and the phrases that name it. Phrases that use the same words for something else are removed
// first ("diversity, equity and inclusion", "bonus points if you…", "pay equity").
const NOT_BENEFITS =
  /(diversity,? equity|equity,? (and|&) inclusion|equity,? inclusion|pay equity|health equity|equity and belonging|bonus points?|(is|are|would be|as) a bonus|brand equity|equity research|private equity|equity (markets|capital markets|derivatives|trading|analyst))/gi

const BENEFITS: Array<[string, RegExp]> = [
  ['Equity', /\b(equity|stock options?|rsus?|restricted stock|employee stock|esop|ownership)\b/i],
  ['Bonus', /\b(bonus(es)?|incentive (pay|plan|compensation)|profit[- ]sharing)\b/i],
  ['Commission', /\b(commissions?|ote\b|on[- ]target earnings)/i],
  ['Health insurance', /\b((medical|health)(,| and|\/)? ?(dental|vision)|(health|medical|healthcare)( care)? (insurance|coverage|plans?|benefits)|private health|dental (insurance|coverage)|health, dental)/i],
  ['401(k)', /\b401\s*\(?k\)?/i],
  ['Pension', /\b(pension|retirement (plan|savings|match|contributions?|benefits)|superannuation|rrsp)\b/i],
  ['Unlimited PTO', /\b(unlimited|flexible|open) (pto|paid time off|vacation|time off|holidays?|leave)\b/i],
  ['Paid time off', /\b(paid time off|\bpto\b|paid vacation|vacation days|days of (annual )?leave|weeks? of (paid )?(vacation|holiday|leave)|annual leave|paid holidays)/i],
  ['Parental leave', /\b(parental|maternity|paternity|family|caregiver) leave\b/i],
  ['Remote stipend', /\b(home[- ]office|wfh|remote[- ]work|work[- ]from[- ]home|equipment|internet|co-?working) (stipend|allowance|budget|reimbursement)/i],
  ['Learning budget', /\b((learning|education(al)?|professional development|training|conference|growth) (stipend|budget|allowance|reimbursement|fund)|tuition (reimbursement|assistance))/i],
  ['Wellness', /\b(wellness|wellbeing|well-being|gym|fitness|mental health) (stipend|allowance|benefits?|programs?|reimbursement|budget|support)/i],
  ['Relocation', /\brelocation (assistance|support|package|bonus|benefits?|stipend)/i],
  ['Meals', /\b((free|catered|daily|provided) (meals|lunch(es)?|breakfast)|meal (stipend|allowance|vouchers?))/i],
  ['Visa sponsorship', /\b(visa sponsorship (is )?(available|provided|offered)|(we|will) sponsor (your |a )?visas?|sponsorship for (work )?visas)/i],
]

/** Benefits the description names, as short labels, most valued first. "Unlimited PTO" replaces "Paid time off". */
export function extractBenefits(html: string | null | undefined): string[] {
  const text = descriptionBlocks(html ?? '').map((b) => b.text).join(' \n ').replace(NOT_BENEFITS, ' ')
  if (!text.trim()) return []
  const found = BENEFITS.filter(([, re]) => re.test(text)).map(([label]) => label)
  return found.includes('Unlimited PTO') ? found.filter((b) => b !== 'Paid time off') : found
}
