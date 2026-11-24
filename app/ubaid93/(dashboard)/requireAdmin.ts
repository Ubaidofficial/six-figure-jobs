import { redirect } from 'next/navigation'

import { getAdminSession } from '../../../lib/admin/auth'

/**
 * The session check every admin page runs itself. The dashboard layout checks too, but Next does not render a layout
 * the client says it already has (client-router requests), so a check only in the layout can be skipped (found
 * 2026-11-24). Pages always render, so the check here always runs.
 */
export async function requireAdmin(): Promise<void> {
  if (!(await getAdminSession())) redirect('/ubaid93/login')
}
