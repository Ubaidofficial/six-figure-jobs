import { permanentRedirect } from 'next/navigation'

export default function Redirect400k() {
  permanentRedirect('/jobs/400k-plus')
}
