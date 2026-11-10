'use client'

// "Copy setup prompt": one paste into Claude Code, Codex, Cursor or Gemini CLI and the agent connects itself.
import * as React from 'react'

export function CopyPrompt({ prompt }: { prompt: string }) {
  const [copied, setCopied] = React.useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard blocked (insecure context or permissions): the prompt is shown below to copy by hand.
    }
  }

  return (
    <div className="mt-3">
      <pre className="whitespace-pre-wrap rounded-lg border border-border bg-muted px-4 py-3 font-mono text-sm text-foreground">
        {prompt}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="mt-3 inline-flex items-center rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-lime-400 focus-visible:outline focus-visible:outline-2"
      >
        {copied ? 'Copied' : 'Copy setup prompt'}
      </button>
      <span role="status" className="sr-only">
        {copied ? 'Setup prompt copied to the clipboard' : ''}
      </span>
    </div>
  )
}
