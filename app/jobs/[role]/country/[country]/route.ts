// app/jobs/[role]/country/[country]/route.ts
// Redirect helper: /jobs/{role}/country/{country} → canonical slice

import type { NextRequest } from 'next/server'
import { redirect } from 'next/navigation'

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ role: string; country: string }> },
) {
  const params = await context.params
  redirect(`/jobs/${params.role}/${params.country}/100k-plus`)
}
