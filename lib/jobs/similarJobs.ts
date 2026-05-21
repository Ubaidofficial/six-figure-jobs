import type { JobWithCompany } from './queryJobs'

const SIMILAR_JOB_MAX_ANNUAL = 500_000

function readOptionalString(source: unknown, key: string): string | null {
  if (!source || typeof source !== 'object') return null
  const value = (source as Record<string, unknown>)[key]
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function readOptionalNumber(source: unknown, key: string): number | null {
  if (!source || typeof source !== 'object') return null
  const value = (source as Record<string, unknown>)[key]
  if (typeof value === 'bigint') return Number(value)
  if (typeof value === 'number' && Number.isFinite(value)) return value
  return null
}

function recentJobTime(job: JobWithCompany): number {
  return (job.postedAt ?? job.createdAt ?? job.updatedAt ?? new Date(0)).getTime()
}

function hasSalaryOutlier(job: JobWithCompany): boolean {
  const annualValues = [
    readOptionalNumber(job, 'minAnnual'),
    readOptionalNumber(job, 'maxAnnual'),
  ].filter((value): value is number => value != null)

  if (annualValues.some((value) => value > SIMILAR_JOB_MAX_ANNUAL)) return true

  const salaryPeriod = readOptionalString(job, 'salaryPeriod')?.toLowerCase() ?? ''
  if (salaryPeriod && salaryPeriod !== 'year' && salaryPeriod !== 'annual') return false

  const rawValues = [
    readOptionalNumber(job, 'salaryMin'),
    readOptionalNumber(job, 'salaryMax'),
  ].filter((value): value is number => value != null)

  return rawValues.some((value) => value > SIMILAR_JOB_MAX_ANNUAL)
}

export function filterSimilarJobs(
  currentJob: JobWithCompany,
  candidates: JobWithCompany[],
  limit = 6,
): JobWithCompany[] {
  const currentLanguage = readOptionalString(currentJob, 'language')
  const currentCountry = currentJob.countryCode?.toUpperCase() ?? null
  const currentCurrency = (currentJob.salaryCurrency ?? currentJob.currency ?? '').toUpperCase()
  const seen = new Set<string>()

  return candidates
    .filter((candidate) => candidate.id !== currentJob.id)
    .filter((candidate) => {
      const candidateLanguage = readOptionalString(candidate, 'language')
      const candidateCountry = candidate.countryCode?.toUpperCase() ?? null
      if (currentLanguage) {
        return candidateLanguage === currentLanguage || Boolean(currentCountry && candidateCountry === currentCountry)
      }
      if (
        !currentLanguage &&
        !candidateLanguage &&
        currentCountry &&
        candidateCountry !== currentCountry
      ) {
        return false
      }
      return true
    })
    .filter((candidate) => {
      if (hasSalaryOutlier(candidate)) return false

      const candidateCurrency = (candidate.salaryCurrency ?? candidate.currency ?? '').toUpperCase()
      if (currentCurrency && candidateCurrency && candidateCurrency !== currentCurrency) return false

      return true
    })
    .sort((a, b) => recentJobTime(b) - recentJobTime(a))
    .filter((candidate) => {
      const companyKey = candidate.companyId || candidate.companyRef?.id || candidate.company || 'unknown-company'
      const key = `${companyKey}::${candidate.title.trim().toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, limit)
}
