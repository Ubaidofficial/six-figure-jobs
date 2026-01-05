// lib/companies/upsertFromBoard.ts

import { prisma } from '../prisma'
import { cleanCompanyName } from '../normalizers/company'
import { detectAtsFromUrl } from '../normalizers/ats'
import type { AtsProvider } from '../scrapers/ats/types'

const companyClient = (prisma as any).company

export interface BoardCompanyInput {
  /** Raw company name scraped from the board */
  rawName: string | null | undefined

  /** Board identifier, e.g. "remoteok", "builtin", "remoterocketship" */
  source: string

  /** Optional website URL if the board provides it */
  websiteUrl?: string | null

  /** Optional LinkedIn URL if the board provides it */
  linkedinUrl?: string | null

  /** Optional apply URL (often points to ATS) */
  applyUrl?: string | null

  /** Optional explicit ATS provider if known from board metadata */
  explicitAtsProvider?: AtsProvider | null

  /** Optional explicit ATS careers URL if directly given */
  explicitAtsUrl?: string | null
}

/** Base slug generator for Company.slug */
function slugifyCompanyName(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return base || 'company'
}

/**
 * Extra hardening on board company names so we never save:
 * - salary strings ("$240k – $290k USD")
 * - job titles ("Senior Android Engineer")
 * - board names ("RemoteOK", "Remotive", "RemoteRocketship", "RemoteAI", "Remote100k")
 */
function sanitizeBoardCompanyName(
  cleanedName: string | null,
  source: string,
): string | null {
  if (!cleanedName) return null

  const name = cleanedName.trim()
  if (!name) return null

  const lc = name.toLowerCase()

  // 1. Block obvious board / aggregator names
  const boardNames = [
    'remoteok',
    'remote ok',
    'remotive',
    'remote rocketship',
    'remote-rocketship',
    'remote 100k',
    'remote100k',
    'remoteai',
    'remote ai',
  ]

  if (boardNames.some((b) => lc === b || lc.startsWith(b + ' '))) {
    return null
  }

  // 2. Block salary-looking strings
  if (
    /\$ ?\d/.test(name) || // starts with a currency
    /\d+\s?k\b/i.test(name) || // "240k"
    /(usd|eur|gbp|cad|aud)\b/i.test(name)
  ) {
    return null
  }

  // 3. If string clearly looks like "Job Title at Company", keep the company part
  const atIdx = lc.indexOf(' at ')
  if (atIdx > 0) {
    const maybeCompany = name.slice(atIdx + 4).trim()
    if (maybeCompany && maybeCompany.length <= 80) {
      return maybeCompany
    }
  }

  // 4. If it contains job-ish words and no org suffix, treat as suspicious
  const jobWords = [
    'engineer',
    'developer',
    'designer',
    'manager',
    'scientist',
    'director',
    'lead',
    'principal',
    'staff',
    'intern',
    'customer success',
    'marketing',
    'sales',
    'product manager',
  ]

  const orgSuffix = /(inc|ltd|llc|corp|gmbh|labs|systems|technologies|group|company)\.?$/

  const isJobLike = jobWords.some((w) => lc.includes(w))
  const hasOrgSuffix = orgSuffix.test(lc)

  if (isJobLike && !hasOrgSuffix) {
    // safer to skip than to create a fake company row
    return null
  }

  return name
}

/**
 * Ensure slug uniqueness: if "scale-ai" exists, create "scale-ai-2", "scale-ai-3", ...
 */
async function ensureUniqueSlug(baseName: string): Promise<string> {
  const base = slugifyCompanyName(baseName)
  let slug = base
  let counter = 2

   
  while (true) {
    const existing = await companyClient.findUnique({
      where: { slug },
    } as any)

    if (!existing) return slug

    slug = `${base}-${counter++}`
  }
}

/**
 * Centralized helper for board → Company ingestion:
 *
 * - Cleans the raw company name
 * - Sanitizes obvious junk (salaries, job titles, board names)
 * - Detects ATS provider + atsUrl (from applyUrl / explicitAtsUrl)
 * - Upserts Company in Prisma
 *
 * Returns the Company record (loosely typed as any).
 */
export async function upsertCompanyFromBoard(
  input: BoardCompanyInput,
): Promise<any | null> {
  const inferredWebsite =
    input.websiteUrl ??
    (input.applyUrl ? inferWebsiteFromUrl(input.applyUrl) : null)

  const cleanedFromNormalizer = cleanCompanyName(input.rawName ?? null)
  const cleanedName = sanitizeBoardCompanyName(
    cleanedFromNormalizer,
    input.source,
  )

  if (!cleanedName) {
    // Garbage name, skip creating a company
    return null
  }

  // Try ATS detection
  let detected = null

  if (input.explicitAtsUrl) {
    detected = detectAtsFromUrl(input.explicitAtsUrl)
  }

  if (!detected && input.applyUrl) {
    detected = detectAtsFromUrl(input.applyUrl)
  }

  let atsProvider: AtsProvider | null = input.explicitAtsProvider ?? null
  let atsUrl: string | null = input.explicitAtsUrl ?? null

  if (detected) {
    atsProvider = detected.provider
    atsUrl = detected.atsUrl
  }

  // 1. Try find existing by name first (most stable)
  let existing = await companyClient.findFirst({
    where: {
      name: { equals: cleanedName, mode: 'insensitive' },
    },
  } as any)

  // 2. If not found and we have an ATS URL, try by atsUrl (same company, different board name)
  if (!existing && atsUrl) {
    existing = await companyClient.findFirst({
      where: {
        atsUrl,
      },
    } as any)
  }

  if (existing) {
    const updateData: any = {}

    // Only fill in ATS details if they are missing
    if (!existing.atsProvider && atsProvider) {
      updateData.atsProvider = atsProvider
    }
    if (!existing.atsUrl && atsUrl) {
      updateData.atsUrl = atsUrl
    }

    // Map websiteUrl → website (real Prisma field)
    if (inferredWebsite && !existing.website) {
      updateData.website = inferredWebsite
    }

    if (input.linkedinUrl && !existing.linkedinUrl) {
      updateData.linkedinUrl = input.linkedinUrl
    }

    if (Object.keys(updateData).length > 0) {
      return await companyClient.update({
        where: { id: existing.id },
        data: updateData,
      } as any)
    }

    return existing
  }

  // Create new company row
  const slug = await ensureUniqueSlug(cleanedName)

  const data: any = {
    name: cleanedName,
    slug,
  }

  if (atsProvider) data.atsProvider = atsProvider
  if (atsUrl) data.atsUrl = atsUrl
  if (inferredWebsite) data.website = inferredWebsite
  if (input.linkedinUrl) data.linkedinUrl = input.linkedinUrl

  const created = await companyClient.create({
    data,
  } as any)

  return created
}

function inferWebsiteFromUrl(applyUrl: string): string | null {
  try {
    const u = new URL(applyUrl)
    const host = u.hostname.replace(/^www\./i, '')
    if (!host) return null
    return `https://${host}`
  } catch {
    return null
  }
}
