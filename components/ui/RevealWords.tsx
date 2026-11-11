import { Fragment } from 'react'

import { cn } from '@/lib/utils'

/**
 * A heading's words, each in its own span, so `data-reveal-stagger` on the heading can bring them in one by one
 * (workflows.io-style word reveal, see ScrollReveal). The text content is unchanged: words joined by single spaces.
 */
export function RevealWords({ text, className }: { text: string; className?: string }) {
  const words = text.split(/\s+/).filter(Boolean)
  return (
    <>
      {words.map((word, i) => (
        <Fragment key={i}>
          <span className={cn('reveal-word', className)}>{word}</span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  )
}
