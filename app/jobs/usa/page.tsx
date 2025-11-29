import { redirect } from 'next/navigation'

export default function USARedirect() {
  redirect('/jobs/country/us')
}