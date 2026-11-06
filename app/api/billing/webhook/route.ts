// Stripe webhook. 404 unless billing and STRIPE_WEBHOOK_SECRET are configured. The body is read as raw text, because the
// signature is computed over the exact bytes Stripe sent; parsing it first would break verification.
import { notFoundResponse, webhookEnabled } from '@/lib/accounts/enabled'

export async function POST(req: Request) {
  if (!webhookEnabled()) return notFoundResponse()
  const [{ handleStripeWebhook }, { getStripe }, { prisma }] = await Promise.all([
    import('@/lib/billing/webhook'),
    import('@/lib/billing/stripe'),
    import('@/lib/prisma'),
  ])
  const rawBody = await req.text()
  const result = await handleStripeWebhook(rawBody, req.headers.get('stripe-signature'), {
    stripe: getStripe(),
    db: prisma,
    secret: process.env.STRIPE_WEBHOOK_SECRET as string,
  })
  return Response.json(result.body, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
}

// Methods this route does not serve answer 404 (not 405), so a disabled or unused route looks like any missing path.
export {
  notFoundResponse as PUT,
  notFoundResponse as PATCH,
  notFoundResponse as DELETE,
  notFoundResponse as OPTIONS,
}
export { notFoundResponse as GET }
