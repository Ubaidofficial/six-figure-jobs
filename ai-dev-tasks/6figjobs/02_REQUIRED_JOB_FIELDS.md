# Required Job Fields — 6figjobs

## Hard Required (job invalid if missing)
- title
- company reference
- source/provider
- applyUrl
- postedAt
- normalized location (country at minimum)
- isExpired = false

## Salary Eligibility
Salary may be shown ONLY if:
- salaryMin or salaryMax exists
- salaryValidated = true
- salaryConfidence >= 80
- currency normalized
- passes salary thresholds

## Optional (never block display)
- description
- AI summary
- benefits
- skills
- company description

## Rule
Optional fields must never gate inclusion.
