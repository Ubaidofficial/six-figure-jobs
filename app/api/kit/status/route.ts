// PATCH {id, status?, notes?} updates one of the user's tracker rows. 404 unless accounts are enabled.
import { accountsEnabled, notFoundResponse } from '@/lib/accounts/enabled'

export async function PATCH(req: Request) {
  if (!accountsEnabled()) return notFoundResponse()
  const { patchStatus } = await import('@/lib/applykit/api')
  return patchStatus(req)
}

// Methods this route does not serve answer 404 (not 405), so a disabled or unused route looks like any missing path.
export { notFoundResponse as GET, notFoundResponse as POST, notFoundResponse as PUT, notFoundResponse as DELETE, notFoundResponse as OPTIONS }
