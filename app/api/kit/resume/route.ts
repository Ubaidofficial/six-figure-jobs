// PUT saves the signed-in user's résumé text, DELETE removes it. 404 unless accounts are enabled.
import { accountsEnabled, notFoundResponse } from '@/lib/accounts/enabled'

export async function PUT(req: Request) {
  if (!accountsEnabled()) return notFoundResponse()
  const { putResume } = await import('@/lib/applykit/api')
  return putResume(req)
}

export async function DELETE(req: Request) {
  if (!accountsEnabled()) return notFoundResponse()
  const { deleteResume } = await import('@/lib/applykit/api')
  return deleteResume(req)
}

// Methods this route does not serve answer 404 (not 405), so a disabled or unused route looks like any missing path.
export { notFoundResponse as GET, notFoundResponse as POST, notFoundResponse as PATCH, notFoundResponse as OPTIONS }
