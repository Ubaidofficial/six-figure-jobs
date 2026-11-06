// POST {id, hash} approves exactly the reviewed draft. 404 unless hosted auto-apply is switched on (accounts on and AUTO_APPLY_ENABLED=true).
import { notFoundResponse } from '@/lib/accounts/enabled'
import { autoApplyEnabled } from '@/lib/autoapply/config'

export async function POST(req: Request) {
  if (!autoApplyEnabled()) return notFoundResponse()
  const { postApprove } = await import('@/lib/autoapply/api')
  return postApprove(req)
}

// Methods this route does not serve answer 404 (not 405), so a disabled or unused route looks like any missing path.
export { notFoundResponse as GET, notFoundResponse as PUT, notFoundResponse as DELETE, notFoundResponse as OPTIONS, notFoundResponse as PATCH }
