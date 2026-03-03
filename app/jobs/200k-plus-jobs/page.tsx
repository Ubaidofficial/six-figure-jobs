import { permanentRedirect } from 'next/navigation'

export default function Redirect200k() {
  permanentRedirect('/jobs/200k-plus')
}
