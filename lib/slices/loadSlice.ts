// lib/slices/loadSlice.ts
import { notFound } from 'next/navigation'
import { prisma } from '../prisma'
import { JobSlice, parseSliceFilters } from './types'
import { parseJobsSlug } from '../jobs/searchSlug'

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
    const country = parsed.countryCode?.toLowerCase()
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
    }

    // --- Country + role + salary: /jobs/us/100k-plus-software-engineer-jobs ---
    if (role && country && !city && !isRemote) {
      candidates.add(`jobs/${role}/${country}/${salarySlug}`)
      candidates.add(`jobs/${salarySlug}/${role}/${country}`)
    }

    // --- Country + city + salary (no role): /jobs/us/chicago/100k-plus-jobs ---
    if (!role && country && city && !isRemote) {
      candidates.add(`jobs/${country}/${city}/${salarySlug}`)
      candidates.add(`jobs/${salarySlug}/${country}/${city}`)
    }

    // --- Country + city + role + salary: /jobs/us/chicago/100k-plus-software-engineer-jobs ---
    if (role && country && city && !isRemote) {
      candidates.add(`jobs/${role}/${country}/${city}/${salarySlug}`)
      candidates.add(`jobs/${salarySlug}/${role}/${country}/${city}`)
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
    console.error('JobSlice not found. Tried slugs:', candidateSlugs)
    notFound()
    throw new Error(
      `JobSlice not found for candidates: ${candidateSlugs.join(', ')}`
    )
  }

  return parseSliceFilters(slice)
}
