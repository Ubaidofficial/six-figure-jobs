// POST {product} -> {url}: starts a Stripe Checkout Session for the signed-in user. 404 unless billing is enabled.
import { billingEnabled, notFoundResponse } from '@/lib/accounts/enabled'

export async function POST(req: Request) {
  if (!billingEnabled()) return notFoundResponse()
  const { postCheckout } = await import('@/lib/billing/api')
  return postCheckout(req)
}

// Methods this route does not serve answer 404 (not 405), so a disabled or unused route looks like any missing path.
export {
  notFoundResponse as PUT,
  notFoundResponse as PATCH,
  notFoundResponse as DELETE,
  notFoundResponse as OPTIONS,
}
export { notFoundResponse as GET }
