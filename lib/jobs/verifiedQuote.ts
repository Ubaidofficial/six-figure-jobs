// lib/jobs/verifiedQuote.ts
//
// Evidence has to be a sentence the posting really contains. A model (or a rule) that says "this job is fully remote"
// must hand back the words that say so, and code checks those words are in the posting before the claim is used. The
// idea is FTJA's (github.com/TaegyuJEONG/ftja, MIT: ftja/verdict.py, finalize.py); see THIRD_PARTY_NOTICES.md.
//
// Pure: no database, no network.
import { decodeJobHtmlEntities } from './descriptionCleaning'

/** Typographic variants a job board or an editor may have swapped, folded so they compare equal. */
function fold(text: string): string {
  return text
    .replace(/[\u2018\u2019\u201B\u2032]/g, "'")
    .replace(/[\u201C\u201D\u201E\u2033]/g, '"')
    .replace(/[\u2010-\u2015\u2212]/g, '-')
    .replace(/[\u00A0\u2007\u202F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * A posting's HTML as plain text, one line per block (paragraph, list item, heading, line break), so sentences do not
 * run together across list items. Entities are decoded; a description that arrives HTML-escaped twice is handled.
 */
export function plainPostingText(html: string | null | undefined): string {
  let text = String(html ?? '')
  for (let pass = 0; pass < 2; pass++) {
    text = decodeJobHtmlEntities(
      text
        .replace(/<script[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[\s\S]*?<\/style>/gi, ' ')
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\/\s*(?:p|div|li|ul|ol|h[1-6]|tr|section|article)\s*>/gi, '\n')
        .replace(/<li[^>]*>/gi, '\n')
        .replace(/<[^>]+>/g, ' '),
    )
    if (!/&lt;|&gt;|<[a-z/]/i.test(text)) break
  }
  return text
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n')
}

const MAX_SENTENCE_CHARS = 600

/** Sentences of plain text (see plainPostingText). A line break always ends a sentence; so does ". ", "! " or "? " before a capital, digit or bullet. */
export function splitSentences(text: string): string[] {
  const out: string[] = []
  for (const line of text.split('\n')) {
    for (const part of line.split(/(?<=[.!?])\s+(?=[A-Z0-9"'(“•*-])/)) {
      const sentence = part.trim()
      if (sentence) out.push(sentence.length > MAX_SENTENCE_CHARS ? sentence.slice(0, MAX_SENTENCE_CHARS) : sentence)
    }
  }
  return out
}

const MIN_QUOTE_CHARS = 12

/**
 * Whether `quote` is in `source`, word for word. Whitespace and typographic quotes/dashes are folded; case is not. `...`
 * (or an ellipsis character) skips the middle of a long sentence: every piece must appear, in order. A quote shorter
 * than MIN_QUOTE_CHARS proves nothing and is rejected.
 */
export function verifyQuote(quote: string | null | undefined, source: string | null | undefined): boolean {
  if (!quote || !source) return false
  const pieces = fold(quote)
    .split(/\.{3}|…/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!pieces.length || pieces.join('').length < MIN_QUOTE_CHARS) return false
  const haystack = fold(source)
  let from = 0
  for (const piece of pieces) {
    const at = haystack.indexOf(piece, from)
    if (at < 0) return false
    from = at + piece.length
  }
  return true
}
