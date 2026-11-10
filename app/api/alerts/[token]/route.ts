// app/api/alerts/[token]/route.ts
// Acting on one alert, identified by the random token in its links.
//   POST (form, from /alerts/<token>): action=confirm|daily|weekly|unsubscribe, then back to the alert's page.
//   POST with "List-Unsubscribe=One-Click" (RFC 8058, sent by Gmail/Yahoo/Apple Mail's unsubscribe button): unsubscribes.
//   GET (a mail app that opens the List-Unsubscribe URL in a browser): the alert's page, where unsubscribing is one click.
import { alertsEnabled } from '@/lib/alerts/config'
import { applyAlertAction, isAlertAction, isToken } from '@/lib/alerts/service'
import { notFoundResponse } from '@/lib/accounts/enabled'
import { getSiteUrl } from '@/lib/seo/site'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ token: string }> }

const pageUrl = (token: string, done?: string) => `${getSiteUrl()}/alerts/${token}${done ? `?done=${done}` : ''}`

export async function GET(_req: Request, { params }: Ctx) {
  const { token } = await params
  if (!alertsEnabled() || !isToken(token)) return notFoundResponse()
  return Response.redirect(pageUrl(token), 303)
}

export async function POST(req: Request, { params }: Ctx) {
  const { token } = await params
  if (!alertsEnabled() || !isToken(token)) return notFoundResponse()

  let form: URLSearchParams
  try {
    form = new URLSearchParams(await req.text())
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const oneClick = form.get('List-Unsubscribe') === 'One-Click'
  const action = oneClick ? 'unsubscribe' : form.get('action')
  if (!isAlertAction(action)) return new Response('Bad Request', { status: 400 })

  try {
    const found = await applyAlertAction(token, action)
    if (!found) return notFoundResponse()
  } catch (err) {
    console.error('[alerts] action failed', err instanceof Error ? err.message.split('\n').pop() : err)
    return new Response('Service Unavailable', { status: 503 })
  }

  if (oneClick) return new Response(null, { status: 200 })
  return Response.redirect(pageUrl(token, action), 303)
}
