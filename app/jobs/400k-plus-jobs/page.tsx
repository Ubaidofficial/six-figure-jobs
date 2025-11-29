import { redirect } from 'next/navigation'

export default function Redirect400k() {
  redirect('/jobs/400k-plus')
}