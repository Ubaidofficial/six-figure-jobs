import { permanentRedirect } from 'next/navigation'

export default function Redirect100k() {
  permanentRedirect('/jobs/100k-plus')
}
