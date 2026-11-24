import { redirect } from 'next/navigation'
import { requireAdmin } from '../requireAdmin'

// Site Config held six copy fields the site never read (only the sponsor slots are used, lib/sponsors/slots.ts); the
// slots now have their own page.
export default async function ConfigPage() {
  await requireAdmin()
  redirect('/ubaid93/sponsors')
}
