'use client'

// The answers a user approved, each with a Copy button, for finishing an application on the employer's own form.
import * as React from 'react'
import { Check, Copy } from 'lucide-react'

import { cn } from '@/lib/utils'

import styles from './autoapply.module.css'

type Answer = { key: string; label: string; text: string }

export function CopyAnswers({ answers }: { answers: Answer[] }) {
  const [copied, setCopied] = React.useState<string | null>(null)

  async function copy(id: string, text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(id)
      window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1800)
    } catch {
      // Clipboard blocked (permissions, insecure context): the text stays selectable.
    }
  }

  const all = answers.map((a) => `${a.label}\n${a.text}`).join('\n\n')

  return (
    <>
      <div className={styles.answers}>
        {answers.map((a) => (
          <div key={a.key} className={styles.answer}>
            <div className={styles.answerBody}>
              <div className={styles.answerLabel}>{a.label}</div>
              <div className={styles.answerText}>{a.text}</div>
            </div>
            <button
              type="button"
              className={cn(styles.copy, copied === a.key && styles.copied)}
              onClick={() => void copy(a.key, a.text)}
              aria-label={`Copy answer: ${a.label}`}
            >
              {copied === a.key ? <Check aria-hidden /> : <Copy aria-hidden />}
              {copied === a.key ? 'Copied' : 'Copy'}
            </button>
          </div>
        ))}
      </div>
      <div className={styles.cta}>
        <button type="button" className={cn(styles.copy, copied === '*' && styles.copied)} onClick={() => void copy('*', all)}>
          {copied === '*' ? <Check aria-hidden /> : <Copy aria-hidden />}
          {copied === '*' ? 'All answers copied' : 'Copy all answers'}
        </button>
        <span role="status" className={styles.cardHint} style={{ marginTop: 0, alignSelf: 'center' }}>
          {copied ? 'Copied to your clipboard.' : ''}
        </span>
      </div>
    </>
  )
}
