import type { Metadata } from 'next'
import Link from 'next/link'

import { SITE_NAME, getSiteUrl, defaultOgImages } from '@/lib/seo/site'

const SITE_URL = getSiteUrl()
const MCP_URL = `${SITE_URL}/api/mcp`
const TITLE = 'Search six-figure jobs in Claude, ChatGPT and Cursor (MCP)'
const DESCRIPTION =
  'Connect your AI assistant to Six Figure Jobs: search jobs with published $100k+ pay from Claude, ChatGPT, Cursor, ' +
  'Claude Code, Codex or Gemini CLI. Free, read-only, no account.'

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: `${SITE_URL}/mcp` },
  openGraph: {
    images: defaultOgImages(),
    title: TITLE,
    description: DESCRIPTION,
    url: `${SITE_URL}/mcp`,
    siteName: SITE_NAME,
    type: 'website',
  },
}

const code = 'block overflow-x-auto rounded-lg border border-border bg-muted px-4 py-3 font-mono text-sm text-foreground'
const h2 = 'mt-10 text-xl font-semibold text-foreground'
const p = 'mt-3 text-base leading-7 text-muted-foreground'

const CLIENTS: Array<{ name: string; steps: string; command?: string }> = [
  {
    name: 'Claude (claude.ai and the desktop app)',
    steps: 'Settings → Connectors → Add custom connector. Name it "6figjobs", paste the address above, and save. Then turn it on in a chat.',
  },
  {
    name: 'ChatGPT',
    steps:
      'In Settings, add a custom connector (MCP server): paste the address above and choose no authentication. Whether custom connectors are available depends on your ChatGPT plan and workspace settings.',
  },
  { name: 'Claude Code', steps: 'Run:', command: `claude mcp add --transport http 6figjobs ${MCP_URL}` },
  { name: 'Codex CLI', steps: 'Run:', command: `codex mcp add 6figjobs --url ${MCP_URL}` },
  { name: 'Gemini CLI', steps: 'Run:', command: `gemini mcp add --transport http 6figjobs ${MCP_URL}` },
  {
    name: 'Cursor',
    steps: 'Add this to ~/.cursor/mcp.json under "mcpServers":',
    command: `"6figjobs": { "url": "${MCP_URL}" }`,
  },
]

export default function McpPage() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Search six-figure jobs from your AI assistant
      </h1>
      <p className={p}>
        Ask Claude, ChatGPT or Cursor things like <em>“find remote staff backend jobs paying over $200k”</em> and get
        answers from {SITE_NAME}: only jobs whose employer publishes the pay, and only six-figure pay (or the local
        equivalent). Free, read-only, no account and no key.
      </p>

      <h2 className={h2}>Server address</h2>
      <p className={p}>Streamable HTTP, no authentication:</p>
      <code className={`${code} mt-3`}>{MCP_URL}</code>

      <h2 className={h2}>Connect your assistant</h2>
      <div className="mt-4 space-y-6">
        {CLIENTS.map((c) => (
          <section key={c.name}>
            <h3 className="font-semibold text-foreground">{c.name}</h3>
            <p className="mt-1 text-muted-foreground">{c.steps}</p>
            {c.command ? <code className={`${code} mt-2`}>{c.command}</code> : null}
          </section>
        ))}
      </div>
      <p className={p}>Menu names in these apps change often; if a step does not match, look for “connectors” or “MCP”.</p>

      <h2 className={h2}>What it can do</h2>
      <ul className="mt-4 list-disc space-y-3 pl-6 text-muted-foreground">
        <li>
          <strong>search_jobs</strong>: free-text search (role, skill, company, seniority, place) with optional
          country, remote-only and minimum-salary filters. Each result has the published salary and a link to the job.
        </li>
        <li>
          <strong>get_job</strong>: one job’s full posting, when it was last confirmed open, and the employer’s apply
          link.
        </li>
      </ul>
      <p className={p}>
        It cannot apply for you or see anything about you. Limits: 60 requests a minute per address. Prefer the
        website? <Link className="underline" href="/jobs">Browse all jobs</Link>.
      </p>
    </main>
  )
}
