// lib/companies/wikidataProfile.ts
//
// Founding year and headcount from Wikidata (CC0), looked up by the company's OFFICIAL WEBSITE (property P856), never by name:
// a name search picks the wrong "Harness" or "Mercury", a website match does not. Wikidata only knows companies somebody
// has written up, so coverage is a measurement to make before relying on it (scripts/measureCompanyProfiles.ts). Pure: this
// file builds the query and reads the answer; the caller makes the request.

export type WikidataProfile = { foundingYear?: number; employees?: number }

/** "harness.io" for https://www.Harness.io/careers: the part both sides of the match agree on. */
export function siteKey(url: string): string | null {
  try {
    return new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return null
  }
}

/** The spellings an official-website claim may use for one host. Wikidata matches the exact string. */
export function websiteVariants(host: string): string[] {
  const hosts = [host, `www.${host}`]
  return hosts.flatMap((h) => [`https://${h}/`, `https://${h}`, `http://${h}/`, `http://${h}`])
}

/** One SPARQL query for many companies (`hosts` are siteKey values). Only characters that cannot break out of <...> are kept. */
export function buildWikidataQuery(hosts: readonly string[]): string {
  const values = hosts
    .filter((h) => /^[a-z0-9.-]+$/.test(h))
    .flatMap(websiteVariants)
    .map((u) => `<${u}>`)
    .join(' ')
  return `SELECT ?site ?inception ?employees WHERE { VALUES ?site { ${values} } ?item wdt:P856 ?site . OPTIONAL { ?item wdt:P571 ?inception } OPTIONAL { ?item wdt:P1128 ?employees } }`
}

type Binding = Record<string, { value: string } | undefined>

/** Per host: the earliest founding year and the largest headcount among the items that claim that website. */
export function parseWikidataBindings(bindings: readonly Binding[]): Map<string, WikidataProfile> {
  const out = new Map<string, WikidataProfile>()
  for (const b of bindings) {
    const key = b.site?.value ? siteKey(b.site.value) : null
    if (!key) continue
    const profile = out.get(key) ?? {}
    const year = Number(b.inception?.value?.match(/^(-?\d{4})/)?.[1])
    if (year >= 1800 && year <= new Date().getUTCFullYear() && (!profile.foundingYear || year < profile.foundingYear)) profile.foundingYear = year
    const employees = Number(b.employees?.value)
    if (Number.isFinite(employees) && employees > 0 && (!profile.employees || employees > profile.employees)) profile.employees = employees
    out.set(key, profile)
  }
  return out
}
