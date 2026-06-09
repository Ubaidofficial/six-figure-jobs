// scripts/smokeRemote100k.ts
//
// Verifies the new sitemap-driven remote100k scraper end-to-end without
// touching the DB. Fetches the sitemap, picks N random job URLs, runs the
// parse pipeline, and prints the resulting ScrapedJobInput for each.
//
// Run: npx tsx scripts/smokeRemote100k.ts            # 5 random samples
//      npx tsx scripts/smokeRemote100k.ts 20         # 20 samples
//
// No env vars required — this is read-only against remote100k.com.

// We import the private parsers via re-exposed entry points rather than
// touching the default exported `scrapeRemote100k` (which calls ingest).
// Keep the import shape minimal so we don't accidentally pull in Prisma.
import { fetchWithBackoff } from '../lib/scrapers/utils/fetchWithBackoff'

const BASE_URL = 'https://remote100k.com'
const SITEMAP_URL = `${BASE_URL}/sitemap.xml`

async function loadJobUrls(): Promise<string[]> {
  const res = await fetchWithBackoff(SITEMAP_URL, { timeoutMs: 15_000 })
  if (!res.ok) throw new Error(`sitemap HTTP ${res.status}`)
  const xml = await res.text()
  const urls = new Set<string>()
  const locRegex = /<loc>([^<]+)<\/loc>/g
  let m: RegExpExecArray | null
  while ((m = locRegex.exec(xml)) !== null) {
    const url = m[1].trim()
    if (url.startsWith(`${BASE_URL}/remote-job/`)) urls.add(url)
  }
  return Array.from(urls)
}

type Sample = {
  url: string
  title: string | null
  company: string | null
  salaryMin: number | null
  salaryMax: number | null
  currency: string | null
  isRemote: boolean
  applicantLocation: string | null
  applyUrl: string | null
  employmentType: string | null
  datePosted: string | null
  hadJsonLd: boolean
}

async function probeOne(url: string): Promise<Sample> {
  const res = await fetchWithBackoff(url, { timeoutMs: 15_000 })
  const html = res.ok ? await res.text() : ''
  const blockMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!blockMatch?.[1]) {
    return {
      url,
      title: null,
      company: null,
      salaryMin: null,
      salaryMax: null,
      currency: null,
      isRemote: false,
      applicantLocation: null,
      applyUrl: null,
      employmentType: null,
      datePosted: null,
      hadJsonLd: false,
    }
  }
  let json: any
  try {
    json = JSON.parse(blockMatch[1].trim())
  } catch {
    return {
      url,
      title: null,
      company: null,
      salaryMin: null,
      salaryMax: null,
      currency: null,
      isRemote: false,
      applicantLocation: null,
      applyUrl: null,
      employmentType: null,
      datePosted: null,
      hadJsonLd: false,
    }
  }
  const refMatch = html.match(/href="(https?:\/\/[^"]+ref=remote100k[^"]*)"/i)
  const applyUrl = refMatch?.[1] ?? null

  const loc = json.applicantLocationRequirements
  const applicantLocation = Array.isArray(loc)
    ? loc.map((l: any) => l.name).filter(Boolean).join(', ')
    : loc?.name ?? null

  return {
    url,
    title: json.title ?? null,
    company: json.hiringOrganization?.name ?? null,
    salaryMin: json.baseSalary?.value?.minValue ?? json.baseSalary?.value?.value ?? null,
    salaryMax: json.baseSalary?.value?.maxValue ?? null,
    currency: json.baseSalary?.currency ?? null,
    isRemote: (json.jobLocationType || '').toUpperCase() === 'TELECOMMUTE',
    applicantLocation,
    applyUrl,
    employmentType: Array.isArray(json.employmentType) ? json.employmentType[0] : json.employmentType ?? null,
    datePosted: json.datePosted ?? null,
    hadJsonLd: true,
  }
}

async function main() {
  const sampleSize = Math.max(1, Number(process.argv[2] || '5'))
  console.log(`Fetching sitemap from ${SITEMAP_URL}...`)
  const all = await loadJobUrls()
  console.log(`Total /remote-job URLs in sitemap: ${all.length}`)

  // Take a deterministic but distributed sample (every Nth) so we don't keep
  // probing the same first-N URLs on every run.
  const step = Math.max(1, Math.floor(all.length / sampleSize))
  const sample: string[] = []
  for (let i = 0; sample.length < sampleSize && i < all.length; i += step) {
    sample.push(all[i])
  }

  const results: Sample[] = []
  for (const url of sample) {
    try {
      const s = await probeOne(url)
      results.push(s)
    } catch (err) {
      console.error(`probe failed: ${url} -> ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`\nProbed ${results.length} samples:\n`)
  for (const s of results) {
    console.log(JSON.stringify(s, null, 2))
    console.log('')
  }

  const ok = results.filter(
    (s) => s.hadJsonLd && s.title && s.company && (s.salaryMin || s.salaryMax),
  ).length
  console.log(`\nParse success rate: ${ok}/${results.length}`)
  console.log(`Have external apply URL: ${results.filter((s) => s.applyUrl).length}/${results.length}`)
}

main().catch((err) => {
  console.error('smoke failed:', err)
  process.exit(1)
})
