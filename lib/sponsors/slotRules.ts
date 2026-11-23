// The pure checks of a sponsor slot's link and last day, apart from slots.ts so the admin form (a client component)
// can use them without pulling in the database client.

/** Only a plain https URL: never http, javascript:, data: or a relative path. Null when it is anything else. */
export function httpsUrl(value: string | undefined): URL | null {
  const raw = value?.trim()
  if (!raw) return null
  try {
    const url = new URL(raw)
    return url.protocol === 'https:' && url.hostname.includes('.') ? url : null
  } catch {
    return null
  }
}

/** "2026-12-31" to the end of that day in UTC (the last moment the slot may show); null for any other text. */
export function endOfDayUtc(value: string | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value?.trim() ?? '')
  if (!m) return null
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d, 23, 59, 59, 999))
  // Reject 2026-02-31 and the like, which Date.UTC rolls into the next month.
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null
}
