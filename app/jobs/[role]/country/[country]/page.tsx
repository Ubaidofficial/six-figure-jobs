// app/jobs/[role]/country/[country]/page.tsx
// Role + country + salary band entrypoint → redirect to slice URL

import { redirect } from 'next/navigation'

export function GET(_: Request, { params }: { params: { role: string; country: string } }) {
  const { role, country } = params
  redirect(`/jobs/${role}/${country}/100k-plus`)
}
