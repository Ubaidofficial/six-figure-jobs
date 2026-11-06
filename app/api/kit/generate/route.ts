// POST {job: slug} makes (and charges for) an application kit. 404 unless accounts are enabled.
import { accountsEnabled, notFoundResponse } from '@/lib/accounts/enabled'

export async function POST(req: Request) {
  if (!accountsEnabled()) return notFoundResponse()
  const { postGenerate } = await import('@/lib/applykit/api')
  return postGenerate(req)
}

// Methods this route does not serve answer 404 (not 405), so a disabled or unused route looks like any missing path.
export { notFoundResponse as GET, notFoundResponse as PUT, notFoundResponse as PATCH, notFoundResponse as DELETE, notFoundResponse as OPTIONS }
