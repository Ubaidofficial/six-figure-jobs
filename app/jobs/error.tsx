'use client'

import { DataUnavailablePage } from '@/components/runtime/DataUnavailablePage'

export default function JobsError() {
  return (
    <DataUnavailablePage
      eyebrow="Live job data temporarily unavailable"
      title="Jobs are temporarily unavailable"
      description="The live job pages hit a server-side data error. Browse stable sections while the job data layer reconnects and recovers."
      links={[
        { href: '/jobs', label: 'Browse jobs', primary: true },
        { href: '/remote', label: 'Remote jobs' },
        { href: '/salary', label: 'Salary guides' },
        { href: '/companies', label: 'Companies' },
      ]}
    />
  )
}
