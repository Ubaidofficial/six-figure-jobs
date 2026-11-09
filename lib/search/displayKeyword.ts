// Search words that are always written in capitals ("seo" reads as a typo in a heading).
const ACRONYMS = new Set(['seo', 'sem', 'ai', 'ml', 'qa', 'ux', 'ui', 'sre', 'hr', 'it', 'pm', 'sql', 'aws', 'gcp', 'api', 'crm', 'erp'])

/** A visitor's search words as a heading: "seo manager" becomes "SEO Manager". Words typed with capitals are kept. */
export function displayKeyword(raw: string): string {
  return raw
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (word !== word.toLowerCase()) return word
      if (ACRONYMS.has(word)) return word.toUpperCase()
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
}
