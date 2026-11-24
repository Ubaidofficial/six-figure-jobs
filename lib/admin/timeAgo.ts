// "4 min ago", "3 h ago", "2 days ago": one wording for the admin console and its alert emails. Pure, so client
// components can use it.
export function since(at: Date, now: number = Date.now()): string {
  const min = Math.round((now - at.getTime()) / 60_000)
  if (min < 60) return `${Math.max(min, 1)} min ago`
  const h = Math.round(min / 60)
  return h < 48 ? `${h} h ago` : `${Math.round(h / 24)} days ago`
}
