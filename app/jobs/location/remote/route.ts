// app/jobs/location/remote/route.ts
// Redirect /jobs/location/remote → canonical remote hub

import { redirect } from 'next/navigation'

export function GET() {
  redirect('/remote')
}
