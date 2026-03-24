'use client'

import { DataUnavailablePage } from '@/components/runtime/DataUnavailablePage'

export default function RemoteError() {
  return (
    <DataUnavailablePage
      eyebrow="Remote jobs temporarily unavailable"
      title="Remote job pages are temporarily unavailable"
      description="The live remote routes hit a server-side data error. Browse the main remote hub or other stable sections while the remote listing layer recovers."
      links={[
        { href: '/remote', label: 'Remote hub', primary: true },
        { href: '/jobs', label: 'Browse jobs' },
        { href: '/salary', label: 'Salary guides' },
        { href: '/companies', label: 'Companies' },
      ]}
    />
  )
}
