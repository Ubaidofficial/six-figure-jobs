// scripts/audit-v2.9.ts
import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'
import { HIGH_SALARY_THRESHOLDS } from '../lib/currency/thresholds'
import { HIGH_SALARY_MIN_CONFIDENCE } from '../lib/jobs/queryJobs'

function sh(cmd: string): string {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8' })
}

function fail(msg: string): never {
  console.error(msg)
  process.exit(1)
}

function formatRows(rows: Array<Record<string, any>>): string {
  if (!rows?.length) return '(no sample rows)'
  return rows
    .map((r) => {
      const id = r.id ?? ''
      const title = r.title ?? ''
      const company = r.company ?? ''
      const url = r.url ?? ''
      const extra =
        r.type || r.employmentType
          ? ` | type=${r.type ?? ''} employmentType=${r.employmentType ?? ''}`
          : ''
      return `- ${id} | ${company} | ${title} | ${url}${extra}`
    })
    .join('\n')
}

async function main() {
  // -----------------------------
  // Static repo checks (no DB)
  // -----------------------------
  try {
    const jobPostingLeaks = sh(
      `grep -RIn "'@type': 'JobPosting'" app | grep -v "app/job" || true`,
    ).trim()
    if (jobPostingLeaks) {
      fail(`JobPosting JSON-LD leak outside app/job:\n${jobPostingLeaks}`)
    }

    const salaryFlagLeaks = sh(
      `grep -RIn "isHundredKLocal: true\\|isHighSalaryLocal: true" app lib/jobs | grep -v "lib/jobs/queryJobs.ts" || true`,
    ).trim()
    if (salaryFlagLeaks) {
      fail(`Salary flag qualification leak:\n${salaryFlagLeaks}`)
    }
  } catch (e: any) {
    fail(`Static audit failed to run: ${e?.message || e}`)
  }

  // -----------------------------
  // DB checks
  // -----------------------------
  if (!process.env.DATABASE_URL) {
    fail('DATABASE_URL is required for v2.9 audit (needs DB to validate published jobs).')
  }

  const prisma = new PrismaClient()

  // IMPORTANT:
  // - Do NOT use Prisma "contains: intern" etc (false-positives: "International", "Internal").
  // - Use Postgres word-boundary regex via \m (start of word) and \M (end of word).
  //
  // Title bans: junior/jr/entry-level/intern/internship/graduate/new grad
  const BANNED_TITLE_RE =
    String.raw`\m(junior|jr\.?|entry([ -]?level)?|intern(ship)?|graduate|new[ -]?grad(uate)?)\M`

  // Type bans: part-time/contract/temporary (either in type OR employmentType)
  const BANNED_TYPE_RE = String.raw`\m(part[ -]?time|contract|temporary)\M`

  try {
    // 1) SalaryValidated must be true for any published job
    const invalidSalaryValidated = await prisma.job.count({
      where: { isExpired: false, salaryValidated: false },
    })
    if (invalidSalaryValidated > 0) {
      fail(`Found ${invalidSalaryValidated} published jobs with salaryValidated=false`)
    }

    // Extra hard guard (safe even if column is NOT NULL)
    const nullSalaryValidated = await prisma.$queryRaw<Array<{ n: bigint }>>`
      select count(*)::bigint as n
      from "Job"
      where "isExpired" = false
        and "salaryValidated" is null
    `
    const nNullSalaryValidated = Number(nullSalaryValidated?.[0]?.n ?? 0n)
    if (nNullSalaryValidated > 0) {
      fail(`Found ${nNullSalaryValidated} published jobs with salaryValidated IS NULL`)
    }

    // 2) Confidence gate
    const lowConfidence = await prisma.job.count({
      where: {
        isExpired: false,
        salaryValidated: true,
        salaryConfidence: { lt: HIGH_SALARY_MIN_CONFIDENCE },
      },
    })
    if (lowConfidence > 0) {
      fail(
        `Found ${lowConfidence} published jobs with salaryConfidence<${HIGH_SALARY_MIN_CONFIDENCE}`,
      )
    }

    // 3) Banned titles (word-boundary regex, with sample)
    const bannedTitleCount = await prisma.$queryRaw<Array<{ n: bigint }>>`
      select count(*)::bigint as n
      from "Job"
      where "isExpired" = false
        and coalesce("title",'') ~* ${BANNED_TITLE_RE}
    `
    const nBannedTitle = Number(bannedTitleCount?.[0]?.n ?? 0n)
    if (nBannedTitle > 0) {
      const sample = await prisma.$queryRaw<
        Array<{ id: string; title: string; company: string; url: string }>
      >`
        select id, title, company, url
        from "Job"
        where "isExpired" = false
          and coalesce("title",'') ~* ${BANNED_TITLE_RE}
        order by "updatedAt" desc
        limit 10
      `
      fail(
        `Found ${nBannedTitle} published jobs with banned title keywords (word-boundary check).\nSample:\n${formatRows(
          sample as any,
        )}`,
      )
    }

    // 4) Banned employment types (word-boundary regex, with sample)
    const bannedTypeCount = await prisma.$queryRaw<Array<{ n: bigint }>>`
      select count(*)::bigint as n
      from "Job"
      where "isExpired" = false
        and (
          coalesce("type",'') ~* ${BANNED_TYPE_RE}
          or coalesce("employmentType",'') ~* ${BANNED_TYPE_RE}
        )
    `
    const nBannedType = Number(bannedTypeCount?.[0]?.n ?? 0n)
    if (nBannedType > 0) {
      const sample = await prisma.$queryRaw<
        Array<{
          id: string
          title: string
          company: string
          url: string
          type: string | null
          employmentType: string | null
        }>
      >`
        select id, title, company, url, "type", "employmentType"
        from "Job"
        where "isExpired" = false
          and (
            coalesce("type",'') ~* ${BANNED_TYPE_RE}
            or coalesce("employmentType",'') ~* ${BANNED_TYPE_RE}
          )
        order by "updatedAt" desc
        limit 10
      `
      fail(
        `Found ${nBannedType} published jobs with banned employment type keywords (word-boundary check).\nSample:\n${formatRows(
          sample as any,
        )}`,
      )
    }

    // 5) Currency-aware threshold violations
    for (const [currency, threshold] of Object.entries(HIGH_SALARY_THRESHOLDS)) {
      const belowThreshold = await prisma.job.count({
        where: {
          isExpired: false,
          salaryValidated: true,
          salaryConfidence: { gte: HIGH_SALARY_MIN_CONFIDENCE },
          currency,
          NOT: {
            OR: [
              { maxAnnual: { gte: BigInt(threshold) } },
              { minAnnual: { gte: BigInt(threshold) } },
            ],
          },
        },
      })
      if (belowThreshold > 0) {
        fail(`Found ${belowThreshold} published ${currency} jobs below threshold ${threshold}`)
      }
    }

    // 6) Hybrid must never be mis-flagged as fully remote
    const hybridMisflaggedRemote = await prisma.job.count({
      where: {
        isExpired: false,
        remoteMode: 'remote',
        locationRaw: { contains: 'hybrid', mode: 'insensitive' },
      },
    })
    if (hybridMisflaggedRemote > 0) {
      fail(
        `Found ${hybridMisflaggedRemote} published jobs with locationRaw containing "hybrid" but remoteMode="remote"`,
      )
    }

    // 7) Remote jobs must have remoteRegion (so remote sitemaps/pages can segment)
    const remoteMissingRemoteRegionEmpty = await prisma.job.count({
      where: {
        isExpired: false,
        remote: true,
        remoteMode: 'remote',
        remoteRegion: '',
      },
    })
    if (remoteMissingRemoteRegionEmpty > 0) {
      fail(`Found ${remoteMissingRemoteRegionEmpty} published remote jobs with remoteRegion=""`)
    }

    const remoteMissingRemoteRegionNull = await prisma.$queryRaw<Array<{ n: bigint }>>`
      select count(*)::bigint as n
      from "Job"
      where "isExpired" = false
        and "remote" = true
        and "remoteMode" = 'remote'
        and "remoteRegion" is null
    `
    const nRemoteRegionNull = Number(remoteMissingRemoteRegionNull?.[0]?.n ?? 0n)
    if (nRemoteRegionNull > 0) {
      fail(`Found ${nRemoteRegionNull} published remote jobs with remoteRegion IS NULL`)
    }
  } finally {
    await prisma.$disconnect()
  }

  console.log('v2.9 audit OK')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
