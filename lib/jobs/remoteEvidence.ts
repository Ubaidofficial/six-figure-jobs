// lib/jobs/remoteEvidence.ts
//
// How remote a role is, read from the posting's own sentences, with the sentence as evidence. FTJA does this with a model
// (github.com/TaegyuJEONG/ftja, MIT: ftja/remote.py; see THIRD_PARTY_NOTICES.md): read only the sentences around remote
// keywords, answer per category, and a "pass" has to point at a sentence. This is the deterministic version for a job
// board, tuned for precision, because what it decides ends up in JSON-LD (`remoteMode` drives `jobLocationType:
// TELECOMMUTE`; see the exception in CLAUDE.md).
//
// Rules of the road:
//  - it answers only when the sentences agree: one posting that says both "fully remote" and "three days in the office",
//    or that says "no remote work", is left unanswered (null) rather than guessed;
//  - every answer carries the sentence it came from, and that sentence is checked to be in the posting (verifyQuote);
//  - negations are read as negations ("not remote", "no remote work"), never as evidence of remote work;
//  - it never overrides a value an ATS gave (see scripts/backfillRemoteEvidence.ts, which fills empty fields only).
//
// Pure: no database, no network.
import { plainPostingText, splitSentences, verifyQuote } from './verifiedQuote'

export type RemoteMode = 'remote' | 'hybrid' | 'onsite'

export type RemoteEvidence = {
  mode: RemoteMode
  /** The sentence that says so, verbatim from the posting. */
  quote: string
}

// "not remote", "no remote work", "remote work is not available", "cannot be done remotely".
const NEGATED_REMOTE = new RegExp(
  [
    "\\b(?:not|isn[’']t|is not|aren[’']t|are not|non|never)[- ](?:a[- ])?(?:fully[- ])?remote\\b",
    '\\bno (?:remote|work[- ]from[- ]home|wfh|telecommut)',
    "\\bremote (?:work|working|roles?|positions?)? ?(?:is|are)? ?(?:not|n[’']t) (?:available|possible|offered|supported|an option|allowed)\\b",
    "\\b(?:can[’']?not|can[’']t|cannot|unable to) be (?:done|performed|worked) remotely\\b",
    '\\bremote (?:work|candidates?|applicants?) (?:will not|won[’\']t|cannot) be considered\\b',
  ].join('|'),
  'i',
)

// What the ROLE is, not what the company is. "Our fully remote, global team" and "remote-first culture" describe the
// employer (measured on 1,482 Lever postings, 2026-11-14: those readings were most of the wrong "remote" answers), so only
// sentences about this role, the person hired, or a labelled field count.
const REMOTE = new RegExp(
  [
    '\\b(?:this|the) (?:\\w+ ){0,3}?(?:role|position|job|opportunity) is (?:a )?(?:fully |100 ?% |completely )?remote\\b',
    '\\bthis is (?:a )?(?:fully |100 ?% |completely )?remote (?:role|position|job|opportunity)\\b',
    '\\bremote[- ](?:role|position|job|opportunity)\\b',
    "\\b(?:you(?:[’']ll| will| can| may)?|candidates?|the (?:successful )?(?:candidate|hire)) (?:work|working) (?:fully |100 ?% |completely )?remotely\\b",
    '\\b(?:location|work ?(?:place|location|model|arrangement|type)) ?[:–-] ?(?:fully |100 ?% )?remote\\b',
    '\\bremote within\\b',
  ].join('|'),
  'i',
)

// A remote claim softened by "most roles", "where possible", "depending on"... is not a fact about this role.
const HEDGED = /\b(?:most|some|many|certain|select)\s+(?:of\s+)?(?:our\s+|the\s+)?(?:roles|positions|jobs|teams|employees)\b|\bfor most\b|\bwhere possible\b|\bdepending on\b|\bmay be\b|\boccasional(?:ly)?\b/i

const HYBRID = new RegExp(
  [
    '\\bhybrid (?:work|role|position|schedule|working|arrangement|set-?up|policy|basis)\\b',
    '\\b(?:this|the|our) (?:role|position|job|opportunity) is (?:a )?hybrid\\b',
    '\\bhybrid\\b[^.;]{0,40}\\b(?:office|days?|on-?site|in[- ]person)\\b',
    '\\b\\d(?:\\s*[-–]\\s*\\d)?\\s*days?\\s*(?:a|per|each|/)\\s*week\\b[^.;]{0,40}\\b(?:office|on-?site|in[- ]person)\\b',
    '\\b(?:office|on-?site|in[- ]person)\\b[^.;]{0,40}\\b\\d(?:\\s*[-–]\\s*\\d)?\\s*days?\\s*(?:a|per|each|/)\\s*week\\b',
    '\\bin[- ]office\\s+\\d\\s*days?\\b',
  ].join('|'),
  'i',
)

// "5 days a week in the office" is full-time on-site, not hybrid.
const EVERY_WORKDAY = /\b(?:[5-7]|five|six|seven)\s*days?\s*(?:a|per|each|\/)\s*week\b/i

const ONSITE = new RegExp(
  [
    '\\b(?:this|the|our) (?:role|position|job) is (?:a )?(?:fully |100 ?% )?(?:on-?site|in[- ]office|in[- ]person)\\b',
    '\\bthis is (?:an? )?(?:fully |100 ?% )?(?:on-?site|in[- ]office|in[- ]person) (?:role|position|job)\\b',
    '\\bon-?site (?:role|position|only|presence is required|attendance is required)\\b',
    '\\b(?:required|expected|must) (?:to )?(?:work|be) (?:on-?site|in the office|in[- ]person)\\b',
    '\\b(?:fully|100 ?%) (?:on-?site|in[- ]office)\\b',
  ].join('|'),
  'i',
)

/**
 * The role's mode when the posting's sentences give one answer, with the sentence; null when it gives none or
 * contradicts itself.
 */
export function findRemoteEvidence(descriptionHtml: string | null | undefined): RemoteEvidence | null {
  const text = plainPostingText(descriptionHtml)
  if (!text) return null

  const hits: Record<RemoteMode, string | null> = { remote: null, hybrid: null, onsite: null }
  let negated: string | null = null
  for (const sentence of splitSentences(text)) {
    if (NEGATED_REMOTE.test(sentence)) {
      negated ??= sentence
      continue // "not remote" must never count as "remote"
    }
    if (HYBRID.test(sentence)) {
      if (EVERY_WORKDAY.test(sentence)) hits.onsite ??= sentence
      else hits.hybrid ??= sentence
    } else if (ONSITE.test(sentence)) hits.onsite ??= sentence
    else if (REMOTE.test(sentence) && !HEDGED.test(sentence)) hits.remote ??= sentence
  }

  const modes = (Object.keys(hits) as RemoteMode[]).filter((m) => hits[m])
  if (modes.length !== 1) return null // nothing said, or it says two things
  const mode = modes[0]
  // "No remote work" next to "fully remote" contradicts; next to "hybrid" or "on-site" it agrees, but there is nothing
  // to add. Either way a negation beside a remote claim is not an answer.
  if (negated && mode === 'remote') return null
  const quote = hits[mode]!
  return verifyQuote(quote, text) ? { mode, quote } : null
}
