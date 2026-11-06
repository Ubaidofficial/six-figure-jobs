// The stored employment type is whatever the source sent: "full_time", "Full-time", "part_time", "internship"...

const LABELS: Record<string, string> = {
  fulltime: 'Full-time',
  parttime: 'Part-time',
  contract: 'Contract',
  contractor: 'Contract',
  contracttohire: 'Contract to hire',
  freelance: 'Freelance',
  internship: 'Internship',
  intern: 'Internship',
  temporary: 'Temporary',
  temp: 'Temporary',
  seasonal: 'Seasonal',
  fellowship: 'Fellowship',
  apprenticeship: 'Apprenticeship',
  volunteer: 'Volunteer',
  perdiem: 'Per diem',
}

/** "full_time" -> "Full-time". Unknown values are shown as capitalised words, never as raw enum text. null when empty. */
export function employmentTypeLabel(value: unknown): string | null {
  const text = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z]+/g, ' ')
    .trim()
  if (!text) return null
  const known = LABELS[text.replace(/ /g, '')]
  if (known) return known
  const words = text.split(' ')
  return [words[0].charAt(0).toUpperCase() + words[0].slice(1), ...words.slice(1)].join(' ')
}
