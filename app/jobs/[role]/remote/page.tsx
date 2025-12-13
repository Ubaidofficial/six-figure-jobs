// app/jobs/[role]/remote/page.tsx
// v2.7: /remote/* is canonical for remote role pages

import { permanentRedirect } from 'next/navigation'

type SearchParams = Record<string, string | string[] | undefined>

type Props = {
  params: Promise<{ role: string }>
  searchParams?: Promise<SearchParams>
}

function buildQueryString(searchParams?: SearchParams): string {
  if (!searchParams) return ''

  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(searchParams)) {
    if (value == null) continue
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v != null) params.append(key, v)
      }
    } else {
      params.set(key, value)
    }
  }

  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export default async function JobsRoleRemoteRedirect({ params, searchParams }: Props) {
  const { role } = await params
  const sp = searchParams ? await searchParams : undefined

  permanentRedirect(`/remote/${role}${buildQueryString(sp)}`)
}

