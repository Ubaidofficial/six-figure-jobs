// GET /api/ubaid93/feedback/:id/screenshot — the screenshot pasted with one feedback item, for the admin feedback page.
// Admin only. 404 when there is none (older feedback kept only "had a screenshot", or the column is not migrated yet).
import { getAdminSession } from '../../../../../../lib/admin/auth'
import { prisma } from '../../../../../../lib/prisma'

export const dynamic = 'force-dynamic'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await getAdminSession())) return new Response('Unauthorized', { status: 401 })
  const { id } = await params
  const row = await prisma.feedback.findUnique({ where: { id }, select: { screenshot: true } }).catch(() => null)
  const match = row?.screenshot?.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/)
  if (!match) return new Response('Not found', { status: 404 })
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: { 'Content-Type': match[1], 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
  })
}
