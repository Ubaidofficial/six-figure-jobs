import { redirect } from 'next/navigation'
import { countryCodeToSlug } from '../../lib/seo/countrySlug'

export default function USARedirect() {
  const slug = countryCodeToSlug('US')
  redirect(`/jobs/country/${slug}`)
}
