/** A post-sign-in destination, only if it is a path on this site; otherwise the fallback. Blocks `//host`, `/\host` and absolute URLs. */
export function safeCallbackPath(value: string | string[] | undefined | null, fallback = '/account'): string {
  const raw = Array.isArray(value) ? value[0] : value
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > 500) return fallback
  if (!raw.startsWith('/') || raw.startsWith('//') || raw.includes('\\')) return fallback
  for (let i = 0; i < raw.length; i++) if (raw.charCodeAt(i) < 0x20) return fallback
  return raw
}
