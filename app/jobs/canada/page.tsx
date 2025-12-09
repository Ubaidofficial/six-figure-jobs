import { redirect } from 'next/navigation'
import { countryCodeToSlug } from '../../../lib/seo/countrySlug'

export default function CanadaRedirect() {
  const slug = countryCodeToSlug('CA')
  redirect(`/jobs/country/${slug}`)
}
