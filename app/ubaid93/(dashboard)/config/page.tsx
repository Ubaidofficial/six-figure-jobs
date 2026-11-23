import { redirect } from 'next/navigation'

// Site Config held six copy fields the site never read (only the sponsor slots are used, lib/sponsors/slots.ts); the
// slots now have their own page.
export default function ConfigPage() {
  redirect('/ubaid93/sponsors')
}
