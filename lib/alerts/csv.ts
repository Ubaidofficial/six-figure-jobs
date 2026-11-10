// lib/alerts/csv.ts

/** One CSV field: quoted, and a leading = + - @ neutralised so a spreadsheet cannot run the value as a formula. */
export function csvField(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return `"${safe.replace(/"/g, '""')}"`
}
