// lib/mcp/protocol.ts
//
// The Model Context Protocol over "streamable HTTP", stateless: every POST carries one JSON-RPC message (or a batch)
// and gets its answer as plain JSON. No sessions, no server-sent events, no sampling: the server only offers tools.
// Spec: https://modelcontextprotocol.io/specification (versions listed in SUPPORTED_PROTOCOL_VERSIONS).
// Pure: the tools are passed in, so this file has no network or database access and is tested on its own.

export const SUPPORTED_PROTOCOL_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'] as const
export const LATEST_PROTOCOL_VERSION = SUPPORTED_PROTOCOL_VERSIONS[0]

export type JsonSchema = Record<string, unknown>

export type ToolResult = { text: string; isError?: boolean }

export type McpTool = {
  name: string
  title: string
  description: string
  inputSchema: JsonSchema
  /** Throws ToolInputError for bad arguments; any other throw is reported to the caller as a generic failure. */
  run: (args: Record<string, unknown>) => Promise<ToolResult>
}

export type ServerInfo = { name: string; title: string; version: string; instructions: string }

/** Bad tool arguments: the message is shown to the caller (it says what to fix). */
export class ToolInputError extends Error {}

type JsonRpcId = string | number | null
type JsonRpcResponse =
  | { jsonrpc: '2.0'; id: JsonRpcId; result: unknown }
  | { jsonrpc: '2.0'; id: JsonRpcId; error: { code: number; message: string } }

export const RPC = { parse: -32700, invalidRequest: -32600, methodNotFound: -32601, invalidParams: -32602 } as const

const ok = (id: JsonRpcId, result: unknown): JsonRpcResponse => ({ jsonrpc: '2.0', id, result })
const fail = (id: JsonRpcId, code: number, message: string): JsonRpcResponse => ({
  jsonrpc: '2.0',
  id,
  error: { code, message },
})

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isId = (v: unknown): v is string | number => typeof v === 'string' || typeof v === 'number'

/**
 * One JSON-RPC message in, its response out. Notifications and client responses (no `method` + `id` pair) get null:
 * the HTTP layer answers those with 202 and no body.
 */
export async function handleMessage(message: unknown, tools: McpTool[], info: ServerInfo): Promise<JsonRpcResponse | null> {
  if (!isObject(message) || message.jsonrpc !== '2.0') return fail(null, RPC.invalidRequest, 'Invalid Request')
  const { id, method } = message
  if (typeof method !== 'string') {
    // A response to a server request; this server never sends any, so there is nothing to do.
    return 'result' in message || 'error' in message ? null : fail(isId(id) ? id : null, RPC.invalidRequest, 'Invalid Request')
  }
  if (id === undefined) return null // notification (notifications/initialized, notifications/cancelled, ...)
  if (!isId(id)) return fail(null, RPC.invalidRequest, 'Invalid Request')

  const params = isObject(message.params) ? message.params : {}

  switch (method) {
    case 'initialize': {
      const requested = params.protocolVersion
      const protocolVersion =
        typeof requested === 'string' && (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
          ? requested
          : LATEST_PROTOCOL_VERSION
      return ok(id, {
        protocolVersion,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: info.name, title: info.title, version: info.version },
        instructions: info.instructions,
      })
    }
    case 'ping':
      return ok(id, {})
    case 'tools/list':
      return ok(id, {
        tools: tools.map(({ name, title, description, inputSchema }) => ({
          name,
          title,
          description,
          inputSchema,
          annotations: { title, readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
        })),
      })
    case 'tools/call': {
      const tool = tools.find((t) => t.name === params.name)
      if (!tool) return fail(id, RPC.invalidParams, `Unknown tool: ${String(params.name)}`)
      const args = params.arguments === undefined ? {} : params.arguments
      if (!isObject(args)) return fail(id, RPC.invalidParams, 'Tool arguments must be an object')
      try {
        const { text, isError } = await tool.run(args)
        return ok(id, { content: [{ type: 'text', text }], isError: Boolean(isError) })
      } catch (err) {
        // Tool failures are results the model can read and react to, not protocol errors.
        const text = err instanceof ToolInputError ? err.message : 'The search is temporarily unavailable. Try again shortly.'
        if (!(err instanceof ToolInputError)) console.error('[mcp] tool failed', tool.name, err instanceof Error ? err.message : err)
        return ok(id, { content: [{ type: 'text', text }], isError: true })
      }
    }
    // Capabilities this server does not offer, answered with empty lists so generic clients do not error out.
    case 'resources/list':
      return ok(id, { resources: [] })
    case 'resources/templates/list':
      return ok(id, { resourceTemplates: [] })
    case 'prompts/list':
      return ok(id, { prompts: [] })
    default:
      return fail(id, RPC.methodNotFound, `Method not found: ${method}`)
  }
}

/**
 * A POST body (already parsed) to what is sent back: null means "202, no body" (only notifications or responses).
 * Batches (allowed by the 2025-03-26 revision) are answered as an array of the responses to their requests.
 */
export async function handleBody(body: unknown, tools: McpTool[], info: ServerInfo): Promise<unknown> {
  if (Array.isArray(body)) {
    if (body.length === 0) return fail(null, RPC.invalidRequest, 'Invalid Request')
    const out = (await Promise.all(body.map((m) => handleMessage(m, tools, info)))).filter((r) => r !== null)
    return out.length > 0 ? out : null
  }
  return handleMessage(body, tools, info)
}

export const parseErrorResponse = () => fail(null, RPC.parse, 'Parse error')
