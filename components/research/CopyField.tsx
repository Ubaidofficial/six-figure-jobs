'use client'

// A read-only text box with a copy button, for the report's citation and embed snippets.
import * as React from 'react'

export function CopyField({ label, value, rows = 3 }: { label: string; value: string; rows?: number }) {
  const [copied, setCopied] = React.useState(false)
  const id = React.useId()

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2500)
    } catch {
      // Clipboard blocked (insecure context or permissions): the text is selectable in the box, so it can be copied by hand.
    }
  }

  return (
    <div className="mt-4">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <textarea
        id={id}
        readOnly
        rows={rows}
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="w-full resize-y rounded-lg border border-border bg-card px-3 py-2 font-mono text-[0.8125rem] leading-relaxed text-foreground"
      />
      <button
        type="button"
        onClick={copy}
        className="mt-2 inline-flex items-center rounded-lg bg-lime-500 px-4 py-2 text-sm font-semibold text-neutral-950 hover:bg-lime-400 focus-visible:outline focus-visible:outline-2"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span role="status" className="sr-only">
        {copied ? `${label} copied to the clipboard` : ''}
      </span>
    </div>
  )
}
