// lib/scrapers/_boardHelpers.ts
import { prisma } from '../prisma'

export type BoardJobInput = {
  board: string
  externalId: string
  title: string
  company: string
  applyUrl: string
  location?: string | null
  salaryText?: string | null
  remote?: boolean
}

function slugifyCompany(name: string) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export async function upsertBoardJob(input: BoardJobInput) {
  const {
    board,
    externalId,
    title,
    company,
    applyUrl,
    location,
    salaryText,
    remote,
  } = input

  const companySlug = slugifyCompany(company || 'unknown-company')

  const companyRecord = await prisma.company.upsert({
    where: { slug: companySlug },
    create: {
      name: company,
      slug: companySlug,
      website: null,
      source: undefined as any, // ignore – not in schema
    } as any,
    update: {},
  })

  const jobId = `board:${board}:${externalId}`
  const source = `board:${board}`

  const data: any = {
    id: jobId,
    title,
    company,
    companyId: companyRecord.id,
    source,
    url: applyUrl,
    applyUrl,
    locationRaw: location ?? null,
    remote: remote ?? null,
    salaryRaw: salaryText ?? null,
    // Leave salaryMin/Max/null – your normalization scripts will fill in.
    isHighSalary: false,
    isHundredKLocal: false,
    isExpired: false,
    lastSeenAt: new Date(),
  }

  await prisma.job.upsert({
    where: { id: jobId },
    update: data,
    create: data,
  })
}
