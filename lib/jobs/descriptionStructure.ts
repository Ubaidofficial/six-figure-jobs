// lib/jobs/descriptionStructure.ts
//
// Turns a sanitized job description (HTML with <h3> headings, see sanitizeDescriptionHtml) into labelled sections the
// page can show with a jump list, so a long posting reads as "Overview / Responsibilities / Minimum qualifications ..."
// instead of one block. Deterministic: it only uses headings the posting already has, and invents none.

export type DescriptionSection = {
  /** Anchor id, unique within the description. */
  id: string
  title: string
  html: string
  /** Boilerplate (equal opportunity, privacy, ...) that is shown folded away so it does not sit between the reader and the apply button. */
  folded: boolean
}

export type StructuredDescription = { sections: DescriptionSection[] }

const LEAD_TITLE = 'Overview'
const FOLDED_TITLE = /equal\s+(employment\s+)?opportunity|\beeo\b|affirmative action|reasonable accommodation|accommodations?\b|privacy|legal notice|disclaimer|e-?verify/i

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim()
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section'
}

/** "Minimum qualifications:" -> "Minimum qualifications". */
function cleanTitle(raw: string): string {
  return stripTags(raw).replace(/[\s:\u2013\u2014-]+$/g, '').trim()
}

/**
 * Splits at the posting's own headings. Returns no sections (so the caller shows the text as one block) unless the
 * description has at least one usable heading, because a single unlabelled block gains nothing from a wrapper.
 * Text before the first heading becomes "Overview"; a heading with no text under it is dropped.
 */
export function structureDescription(html: string): StructuredDescription {
  const source = String(html || '').trim()
  if (!source) return { sections: [] }

  const parts = source.split(/<h3>([\s\S]*?)<\/h3>/i)
  // parts = [lead, title1, body1, title2, body2, ...]
  const raw: Array<{ title: string; html: string }> = []
  const lead = parts[0].trim()
  if (lead && stripTags(lead)) raw.push({ title: LEAD_TITLE, html: lead })
  for (let i = 1; i < parts.length; i += 2) {
    const title = cleanTitle(parts[i])
    const body = (parts[i + 1] ?? '').trim()
    if (!title || !stripTags(body)) continue
    raw.push({ title, html: body })
  }

  if (raw.length === 0 || (raw.length === 1 && raw[0].title === LEAD_TITLE)) return { sections: [] }

  const used = new Set<string>()
  const sections = raw.map(({ title, html: body }) => {
    let id = `desc-${slugify(title)}`
    for (let n = 2; used.has(id); n++) id = `desc-${slugify(title)}-${n}`
    used.add(id)
    return { id, title, html: body, folded: FOLDED_TITLE.test(title) }
  })
  return { sections }
}
