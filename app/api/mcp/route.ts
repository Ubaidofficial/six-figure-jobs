// app/api/mcp/route.ts
// Public, read-only MCP server ("streamable HTTP", stateless, JSON responses): lets Claude, ChatGPT, Cursor and other
// assistants search our jobs. No account and no cookies are read. How to connect: /mcp. Protocol: lib/mcp/protocol.ts.
import { createHash } from 'node:crypto'

import { handleBody, parseErrorResponse } from '@/lib/mcp/protocol'
import { MCP_TOOLS, SERVER_INFO } from '@/lib/mcp/tools'
import { createRateLimiter } from '@/lib/jobs/jobReport'

export const dynamic = 'force-dynamic'

const MAX_BODY_BYTES = 64 * 1024
const limiter = createRateLimiter()
const PER_MINUTE = 60

// Browser-based clients (e.g. the MCP Inspector) need CORS. Safe: nothing here depends on who is asking.
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID',
}

const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS, ...extra },
  })

export async function POST(req: Request) {
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'unknown'
  const key = createHash('sha256').update(`sfj-mcp:${ip}`).digest('hex').slice(0, 24)
  if (!limiter.allow(key, PER_MINUTE, 60_000)) {
    return json({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Too many requests; try again in a minute.' } }, 429, {
      'Retry-After': '60',
    })
  }

  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) return json(parseErrorResponse(), 413)
  let body: unknown
  try {
    body = JSON.parse(text)
  } catch {
    return json(parseErrorResponse(), 400)
  }

  const out = await handleBody(body, MCP_TOOLS, SERVER_INFO)
  if (out === null) return new Response(null, { status: 202, headers: CORS })
  return json(out)
}

// No server-to-client stream and no sessions: the spec's answer for both is 405.
const notAllowed = () => new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST, OPTIONS', ...CORS } })
export const GET = notAllowed
export const DELETE = notAllowed

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS })
}
