// app/jobs/150k-plus/page.tsx

import { permanentRedirect } from 'next/navigation'

export default function Redirect150kPlus() {
  permanentRedirect('/jobs/100k-plus')
}

