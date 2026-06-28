// lib/seo/jobPostingEligibility.ts
// Single source of truth for Google Jobs eligibility of a JobPosting JSON-LD
// object. Used by the daily production schema smoke test (scripts/seo-schema-smoke.ts)
// AND by a per-PR unit test against the builder output, so the same rules gate
// both. Returns a list of human-readable problems; empty array = eligible.

export function validateJobPostingEligibility(jobPosting: any): string[] {
  const errors: string[] = []

  if (!jobPosting || jobPosting['@type'] !== 'JobPosting') {
    return ['Missing JobPosting JSON-LD']
  }

  // Google Jobs required fields.
  if (!jobPosting.title) errors.push('Missing title')
  if (!jobPosting.description) errors.push('Missing description')
  if (!jobPosting.datePosted) errors.push('Missing datePosted')
  if (!jobPosting.validThrough) errors.push('Missing validThrough')
  if (!jobPosting.hiringOrganization || !jobPosting.hiringOrganization.name) {
    errors.push('Missing hiringOrganization.name')
  }

  // A location signal is required: a physical jobLocation OR (for remote roles)
  // applicantLocationRequirements + the TELECOMMUTE marker.
  const hasPhysicalLocation = Boolean(jobPosting.jobLocation)
  const hasRemoteSignal =
    jobPosting.jobLocationType === 'TELECOMMUTE' ||
    Boolean(jobPosting.applicantLocationRequirements)
  if (!hasPhysicalLocation && !hasRemoteSignal) {
    errors.push('Missing jobLocation or applicantLocationRequirements/TELECOMMUTE')
  }

  // If salary is advertised it must carry a usable amount.
  if (jobPosting.baseSalary) {
    if (!jobPosting.baseSalary.value || !jobPosting.baseSalary.value.minValue) {
      errors.push('baseSalary present but missing value/minValue')
    }
  }

  return errors
}
