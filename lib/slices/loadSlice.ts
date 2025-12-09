// lib/slices/loadSlice.ts
import { notFound } from 'next/navigation'
import { prisma } from '../prisma'
import { JobSlice, parseSliceFilters } from './types'
import type { JobSlice as JobSliceRow } from '@prisma/client'
import { parseJobsSlug } from '../jobs/searchSlug'
import { countryCodeToSlug, countrySlugToCode } from '../seo/countrySlug'

/**
 * Load a JobSlice for /jobs/[...slug] URLs.
 *
 * Supports both:
 *   - Legacy internal slugs like:
 *       jobs/software-engineer/100k-plus
 *       jobs/product-manager/200k-plus
 *   - New salary-first SEO slugs like:
 *       /jobs/100k-plus-jobs
 *       /jobs/100k-plus-software-engineer-jobs
 *       /jobs/us/100k-plus-software-engineer-jobs
 *       /jobs/us/chicago/100k-plus-software-engineer-jobs
 *       /jobs/remote/100k-plus-jobs
 */
export async function loadSliceFromParams(
  slugSegments: string[] | undefined
): Promise<JobSlice> {
  const segments = slugSegments ?? []

  if (segments.length === 0) {
    notFound()
    throw new Error('JobSlice not found (no segments)')
  }

  const candidates = new Set<string>()

  // 1) Baseline: exactly as in the URL
  // e.g. /jobs/100k-plus-software-engineer-jobs
  candidates.add(['jobs', ...segments].join('/'))

  // 2) Salary-first interpretation using parseJobsSlug
  const parsed = parseJobsSlug(segments)

  if (parsed.salaryMin) {
    // Map salaryMin → bucket slug
    let salarySlug = '100k-plus'
    if (parsed.salaryMin === 200_000) salarySlug = '200k-plus'
    else if (parsed.salaryMin === 300_000) salarySlug = '300k-plus'
    else if (parsed.salaryMin === 400_000) salarySlug = '400k-plus'

    const role = parsed.roleSlug
    const countryCode = parsed.countryCode
    const country = countryCode?.toLowerCase()
    const countrySlug = countryCode ? countryCodeToSlug(countryCode) : null
    const city = parsed.citySlug
    const isRemote = parsed.remoteOnly

    // --- Pure salary page: /jobs/100k-plus-jobs ---
    if (!role && !country && !city && !isRemote) {
      // If you seed JobSlice rows like "jobs/100k-plus"
      candidates.add(`jobs/${salarySlug}`)
    }

    // --- Role + salary: /jobs/100k-plus-software-engineer-jobs ---
    if (role && !country && !city && !isRemote) {
      // Matches what bootstrapRoleSlices.ts seeded:
      //   jobs/software-engineer/100k-plus
      candidates.add(`jobs/${role}/${salarySlug}`)
      // and older variant if it exists:
      candidates.add(`jobs/${salarySlug}/${role}`)
    }

    // --- Country + salary (no role): /jobs/us/100k-plus-jobs ---
    if (!role && country && !city && !isRemote) {
      candidates.add(`jobs/${country}/${salarySlug}`)
      candidates.add(`jobs/${salarySlug}/${country}`)
      if (countrySlug && countrySlug !== country) {
        candidates.add(`jobs/${countrySlug}/${salarySlug}`)
        candidates.add(`jobs/${salarySlug}/${countrySlug}`)
      }
    }

    // --- Country + role + salary: /jobs/us/100k-plus-software-engineer-jobs ---
    if (role && country && !city && !isRemote) {
      candidates.add(`jobs/${role}/${country}/${salarySlug}`)
      candidates.add(`jobs/${salarySlug}/${role}/${country}`)
      if (countrySlug && countrySlug !== country) {
        candidates.add(`jobs/${role}/${countrySlug}/${salarySlug}`)
        candidates.add(`jobs/${salarySlug}/${role}/${countrySlug}`)
      }
    }

    // --- Country + city + salary (no role): /jobs/us/chicago/100k-plus-jobs ---
    if (!role && country && city && !isRemote) {
      candidates.add(`jobs/${country}/${city}/${salarySlug}`)
      candidates.add(`jobs/${salarySlug}/${country}/${city}`)
      if (countrySlug && countrySlug !== country) {
        candidates.add(`jobs/${countrySlug}/${city}/${salarySlug}`)
        candidates.add(`jobs/${salarySlug}/${countrySlug}/${city}`)
      }
    }

    // --- Country + city + role + salary: /jobs/us/chicago/100k-plus-software-engineer-jobs ---
    if (role && country && city && !isRemote) {
      candidates.add(`jobs/${role}/${country}/${city}/${salarySlug}`)
      candidates.add(`jobs/${salarySlug}/${role}/${country}/${city}`)
      if (countrySlug && countrySlug !== country) {
        candidates.add(`jobs/${role}/${countrySlug}/${city}/${salarySlug}`)
        candidates.add(`jobs/${salarySlug}/${role}/${countrySlug}/${city}`)
      }
    }

    // --- Remote slices (future-friendly) ---
    if (isRemote && !country && !city) {
      if (role) {
        candidates.add(`jobs/${role}/remote/${salarySlug}`)
        candidates.add(`jobs/remote/${role}/${salarySlug}`)
        candidates.add(`jobs/remote/${salarySlug}/${role}`)
      } else {
        candidates.add(`jobs/remote/${salarySlug}`)
        candidates.add(`jobs/${salarySlug}/remote`)
      }
    }
  }

  const candidateSlugs = Array.from(candidates)

  const slice = await prisma.jobSlice.findFirst({
    where: {
      slug: { in: candidateSlugs },
    },
  })

  if (!slice) {
    const fallback = buildFallbackSlice(segments)
    if (fallback) {
      return parseSliceFilters(fallback)
    }

    console.error('JobSlice not found. Tried slugs:', candidateSlugs)
    notFound()
    throw new Error(
      `JobSlice not found for candidates: ${candidateSlugs.join(', ')}`
    )
  }

  return parseSliceFilters(slice)
}

function buildFallbackSlice(segments: string[]): JobSliceRow | null {
  // Support role/country/band pattern even if not pre-seeded
  if (segments.length === 3) {
        const [roleSlug, countryCodeRaw, bandSlug] = segments
        const bandMap: Record<string, number> = {
          '100k-plus': 100_000,
          '200k-plus': 200_000,
          '300k-plus': 300_000,
          '400k-plus': 400_000,
        }
        const minAnnual = bandMap[bandSlug]
        if (minAnnual) {
      const countryCode =
        countryCodeRaw.length === 2
          ? countryCodeRaw.toUpperCase()
          : countrySlugToCode(countryCodeRaw) || countryCodeRaw.toUpperCase()
          const slug = `jobs/${segments.join('/')}`
          return {
            id: slug,
            slug: `jobs/${segments.join('/')}`,
            type: 'role-country',
        filtersJson: JSON.stringify({
          roleSlugs: [roleSlug],
          countryCode,
          minAnnual,
          isHundredKLocal: true,
        }),
        jobCount: 0,
        title: null,
        description: null,
        h1: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    }
  }

  return null
}
