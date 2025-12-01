// app/jobs/location/remote/route.ts
// Redirect /jobs/location/remote → canonical remote listing

import { redirect } from 'next/navigation'

export function GET() {
  redirect('/remote/software-engineer') // fallback default; main remote browsing lives in role pages
}
