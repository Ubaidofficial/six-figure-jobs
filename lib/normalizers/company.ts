// lib/normalizers/company.ts

/**
 * Clean up noisy "company names" scraped from boards.
 *
 * Examples it should fix / reject:
 * - "Remote"                      → null
 * - "$240k – $290k USD"          → null
 * - "Full Time"                  → null
 * - "Marketing / AI"             → null
 * - "Acme Inc - Remote"          → "Acme Inc"
 * - "Figma (Remote, US)"         → "Figma"
 */
export function cleanCompanyName(raw: string | null | undefined): string | null {
  if (!raw) return null

  // Normalize whitespace
  let name = raw.replace(/\s+/g, ' ').trim()
  if (!name) return null

  const lower = name.toLowerCase()

  // Obvious garbage tokens that are not company names
  const bannedExact = new Set([
    'remote',
    'anywhere',
    'worldwide',
    'global',
    'full time',
    'full-time',
    'part time',
    'part-time',
    'contract',
    'internship',
    'temporary',
    'marketing',
    'ai',
  ])

  if (bannedExact.has(lower)) {
    return null
  }

  // Salary-like strings: "$240k – $290k USD", "120000 - 180000", etc.
  const hasMoneyTokens = /[$€£]|usd|eur|cad|aud|₹|¥/i.test(name)
  const hasKPattern = /\d+\s*[kK]\b/.test(name)
  const hasRange = /\d+\s*[-–]\s*\d+/.test(name)

  const lettersOnly = name.replace(/[^a-zA-Z]/g, '')
  const hasLetters = lettersOnly.length > 0

  if ((hasMoneyTokens || hasKPattern || hasRange) && !hasLetters) {
    // It's basically just a salary string, not a company
    return null
  }

  // Strip common trailing job-type / location junk from patterns like:
  // "Acme Inc - Remote", "Figma – Full Time", etc.
  const separatorMatch = name.match(/^(.+?)[\s\-–|]+(remote|hybrid|full time|full-time|part time|part-time|contract|internship|temporary|onsite|on site)$/i)
  if (separatorMatch && separatorMatch[1]) {
    name = separatorMatch[1].trim()
  }

  // Strip parenthetical qualifiers at the end:
  // "Figma (Remote, US)" → "Figma"
  name = name.replace(/\s*\([^)]*\)\s*$/, '').trim()

  // After stripping, re-check
  if (!name) return null

  // If it's very short and generic, discard
  if (name.length < 2) return null
  if (!/[a-zA-Z]/.test(name)) return null

  // Final length sanity cap: if absurdly long, likely not a company name
  if (name.length > 80) {
    // Try to keep the first segment before " - " if it looks valid
    const firstPart = name.split(/\s+-\s+/)[0]?.trim()
    if (firstPart && firstPart.length >= 2 && firstPart.length <= 80 && /[a-zA-Z]/.test(firstPart)) {
      return firstPart
    }
    return null
  }

  return name
}
