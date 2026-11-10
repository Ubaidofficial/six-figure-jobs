import { handleBody, handleMessage, LATEST_PROTOCOL_VERSION, RPC, ToolInputError, type McpTool } from '@/lib/mcp/protocol'

jest.mock('@/lib/prisma', () => ({ prisma: {} }))
import { readCountry, readJobRef } from '@/lib/mcp/tools'

const INFO = { name: 'test', title: 'Test', version: '1.0.0', instructions: 'Use the tools.' }

const echo: McpTool = {
  name: 'echo',
  title: 'Echo',
  description: 'Echoes "say".',
  inputSchema: { type: 'object', properties: { say: { type: 'string' } } },
  async run(args) {
    if (typeof args.say !== 'string') throw new ToolInputError('"say" must be a string.')
    if (args.say === 'boom') throw new Error('database down: secret detail')
    return { text: args.say }
  },
}
const tools = [echo]
const req = (id: number | string, method: string, params?: unknown) => ({ jsonrpc: '2.0', id, method, params })

describe('MCP protocol', () => {
  it('initialize echoes a supported protocol version and offers tools only', async () => {
    const res: any = await handleMessage(req(1, 'initialize', { protocolVersion: '2025-06-18', capabilities: {} }), tools, INFO)
    expect(res.result.protocolVersion).toBe('2025-06-18')
    expect(res.result.capabilities).toEqual({ tools: { listChanged: false } })
    expect(res.result.serverInfo).toEqual({ name: 'test', title: 'Test', version: '1.0.0' })
    expect(res.result.instructions).toBe('Use the tools.')
  })

  it('initialize answers an unknown version with the latest it supports', async () => {
    const res: any = await handleMessage(req(1, 'initialize', { protocolVersion: '1999-01-01' }), tools, INFO)
    expect(res.result.protocolVersion).toBe(LATEST_PROTOCOL_VERSION)
  })

  it('lists tools as read-only', async () => {
    const res: any = await handleMessage(req('a', 'tools/list'), tools, INFO)
    expect(res.id).toBe('a')
    expect(res.result.tools).toEqual([
      expect.objectContaining({ name: 'echo', inputSchema: echo.inputSchema, annotations: expect.objectContaining({ readOnlyHint: true }) }),
    ])
  })

  it('calls a tool and returns text content', async () => {
    const res: any = await handleMessage(req(2, 'tools/call', { name: 'echo', arguments: { say: 'hi' } }), tools, INFO)
    expect(res.result).toEqual({ content: [{ type: 'text', text: 'hi' }], isError: false })
  })

  it('reports bad arguments as a tool error the model can read', async () => {
    const res: any = await handleMessage(req(3, 'tools/call', { name: 'echo', arguments: {} }), tools, INFO)
    expect(res.result).toEqual({ content: [{ type: 'text', text: '"say" must be a string.' }], isError: true })
  })

  it('never leaks an internal error message', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const res: any = await handleMessage(req(4, 'tools/call', { name: 'echo', arguments: { say: 'boom' } }), tools, INFO)
    expect(res.result.isError).toBe(true)
    expect(res.result.content[0].text).not.toContain('secret')
  })

  it('rejects unknown tools, non-object arguments and unknown methods', async () => {
    const unknownTool: any = await handleMessage(req(5, 'tools/call', { name: 'nope' }), tools, INFO)
    expect(unknownTool.error.code).toBe(RPC.invalidParams)
    const badArgs: any = await handleMessage(req(6, 'tools/call', { name: 'echo', arguments: [1] }), tools, INFO)
    expect(badArgs.error.code).toBe(RPC.invalidParams)
    const unknownMethod: any = await handleMessage(req(7, 'sampling/createMessage'), tools, INFO)
    expect(unknownMethod.error.code).toBe(RPC.methodNotFound)
  })

  it('answers ping and the empty resource and prompt lists', async () => {
    expect(((await handleMessage(req(8, 'ping'), tools, INFO)) as any).result).toEqual({})
    expect(((await handleMessage(req(9, 'resources/list'), tools, INFO)) as any).result).toEqual({ resources: [] })
    expect(((await handleMessage(req(10, 'prompts/list'), tools, INFO)) as any).result).toEqual({ prompts: [] })
  })

  it('gives notifications and client responses no answer', async () => {
    expect(await handleMessage({ jsonrpc: '2.0', method: 'notifications/initialized' }, tools, INFO)).toBeNull()
    expect(await handleMessage({ jsonrpc: '2.0', id: 1, result: {} }, tools, INFO)).toBeNull()
    expect(await handleBody([{ jsonrpc: '2.0', method: 'notifications/initialized' }], tools, INFO)).toBeNull()
  })

  it('rejects malformed messages', async () => {
    expect(((await handleMessage({ id: 1, method: 'ping' }, tools, INFO)) as any).error.code).toBe(RPC.invalidRequest)
    expect(((await handleMessage('x', tools, INFO)) as any).error.code).toBe(RPC.invalidRequest)
    expect(((await handleMessage({ jsonrpc: '2.0', id: {}, method: 'ping' }, tools, INFO)) as any).error.code).toBe(RPC.invalidRequest)
    expect(((await handleBody([], tools, INFO)) as any).error.code).toBe(RPC.invalidRequest)
  })

  it('answers a batch with the responses to its requests only', async () => {
    const out: any = await handleBody([req(1, 'ping'), { jsonrpc: '2.0', method: 'notifications/initialized' }, req(2, 'ping')], tools, INFO)
    expect(out.map((r: any) => r.id)).toEqual([1, 2])
  })
})

describe('MCP tool arguments', () => {
  it('reads country codes', () => {
    expect(readCountry(undefined)).toBeUndefined()
    expect(readCountry('us')).toBe('US')
    expect(readCountry('UK')).toBe('GB')
    expect(() => readCountry('United States')).toThrow(ToolInputError)
  })

  it('reads a job reference from a URL or a slug', () => {
    expect(readJobRef('https://www.6figjobs.com/job/senior-engineer-abc123?utm_source=mcp&utm_medium=ai_assistant')).toBe('senior-engineer-abc123')
    expect(readJobRef('/job/senior-engineer-abc123/')).toBe('senior-engineer-abc123')
    expect(readJobRef('senior-engineer-abc123')).toBe('senior-engineer-abc123')
    expect(readJobRef('https://www.6figjobs.com/job/ats%3Agreenhouse%3A123')).toBe('ats:greenhouse:123')
    expect(() => readJobRef('two words')).toThrow(ToolInputError)
  })
})

describe('MCP source exclusion', () => {
  it('leaves freehire jobs out of the MCP query, and only when asked', () => {
    const { buildWhere } = jest.requireActual('@/lib/jobs/queryJobs')
    const { MCP_EXCLUDED_SOURCES } = jest.requireActual('@/lib/mcp/tools')
    const json = (v: unknown) => JSON.stringify(v, (_k, x) => (typeof x === 'bigint' ? x.toString() : x))
    expect(MCP_EXCLUDED_SOURCES).toContain('board:freehire')
    expect(json(buildWhere({ excludeSources: MCP_EXCLUDED_SOURCES }))).toContain('{"source":{"notIn":["board:freehire"]}}')
    expect(json(buildWhere({}))).not.toContain('notIn":["board:freehire"')
  })
})
