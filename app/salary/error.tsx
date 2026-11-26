'use client'

import { DataUnavailablePage } from '@/components/runtime/DataUnavailablePage'

// Shown when a salary page cannot read its data (the database was unreachable or a query timed out). The response stays
// a server error, which search engines treat as temporary; an empty guide would instead say "0 jobs" and turn noindex.
export default function SalaryError() {
  return (
    <DataUnavailablePage
      eyebrow="Salary data temporarily unavailable"
      title="This salary guide is temporarily unavailable"
      description="The salary guide could not load its live pay data just now. Please try again in a minute, or browse other sections in the meantime."
      links={[
        { href: '/salary', label: 'All salary guides', primary: true },
        { href: '/jobs', label: 'Browse jobs' },
        { href: '/remote', label: 'Remote jobs' },
        { href: '/companies', label: 'Companies' },
      ]}
    />
  )
}
