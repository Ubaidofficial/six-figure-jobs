// app/jobs/[role]/country/[country]/route.ts
// Redirect helper: /jobs/{role}/country/{country} → canonical slice

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { countryCodeToSlug, countrySlugToCode } from '../../../../../lib/seo/countrySlug'

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ role: string; country: string }> },
) {
  const params = await context.params
  const role = params.role.toLowerCase()
  const rawCountry = params.country.toLowerCase()
  const countryCode =
    rawCountry.length === 2
      ? rawCountry.toUpperCase()
      : countrySlugToCode(rawCountry)

  const canonicalCountry = countryCodeToSlug(countryCode ?? '') ?? rawCountry
  const target = new URL(`/jobs/${role}/${canonicalCountry}/100k-plus`, request.url)
  return NextResponse.redirect(target, 308)
}
