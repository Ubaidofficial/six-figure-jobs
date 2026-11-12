'use client'

import * as React from 'react'
import Link from '@/components/ui/Link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

import styles from './applykit.module.css'

export interface KitData {
  coverLetter: string
  bullets: string[]
  keywordGaps: string[]
}

const MESSAGES: Record<string, string> = {
  no_resume: 'Add your résumé first.',
  job_not_found: 'This job is no longer listed, so a new kit cannot be made for it.',
  insufficient_credits: 'You do not have enough credits.',
  ai_unavailable: 'The writing service did not answer. You were not charged. Try again in a minute.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = React.useState(false)
  return (
    <Button
      variant="tertiary"
      size="sm"
      aria-label={`Copy ${label}`}
      onClick={() => {
        navigator.clipboard
          ?.writeText(text)
          .then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
          .catch(() => {})
      }}
    >
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}

export function KitView({
  slug,
  kit,
  canGenerate,
  hasResume,
  stale,
  balance,
  cost,
}: {
  slug: string
  kit: KitData | null
  /** False when the job is no longer listed: an existing kit can still be read. */
  canGenerate: boolean
  hasResume: boolean
  /** The résumé was changed after this kit was made. */
  stale: boolean
  balance: number
  cost: number
}) {
  const router = useRouter()
  const [busy, setBusy] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const plural = cost === 1 ? 'credit' : 'credits'

  async function generate() {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/kit/generate', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ job: slug }),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.status === 401) return window.location.assign(`/sign-in?callbackUrl=${encodeURIComponent(`/account/kit/${slug}`)}`)
      if (res.ok) {
        router.refresh()
      } else {
        setError(MESSAGES[data.error ?? ''] ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    }
    setBusy(false)
  }

  // With a kit already made from the current résumé there is nothing to buy: asking again would return the same kit.
  const action = !canGenerate || (kit && !stale) ? null : !hasResume ? (
    <p className={styles.small}>
      <Link href="/account/applications">Add your résumé</Link> to create a kit.
    </p>
  ) : balance < cost ? (
    <p className={styles.small}>
      A kit costs {cost} {plural} and you have {balance}. <Link href="/account">Get credits</Link>.
    </p>
  ) : (
    <div className={styles.row}>
      <Button loading={busy} onClick={() => void generate()}>
        {kit ? `Make a new kit from your updated résumé for ${cost} ${plural}` : `Create kit for ${cost} ${plural}`}
      </Button>
      <span className={styles.small}>You have {balance}. You are charged only if the kit is delivered.</span>
    </div>
  )

  return (
    <>
      {stale && kit ? (
        <p role="status" className={styles.small}>
          Your résumé changed after this kit was made. Making a new kit uses your current résumé.
        </p>
      ) : null}
      {action}
      {error ? (
        <p role="alert" className={styles.small}>
          {error}
        </p>
      ) : null}

      {kit ? (
        <>
          <section aria-labelledby="letter-h">
            <div className={styles.sectionHead}>
              <h2 id="letter-h" className="text-base font-semibold">
                Cover letter
              </h2>
              <CopyButton text={kit.coverLetter} label="cover letter" />
            </div>
            <pre className={styles.letter}>{kit.coverLetter}</pre>
          </section>

          <section aria-labelledby="bullets-h">
            <div className={styles.sectionHead}>
              <h2 id="bullets-h" className="text-base font-semibold">
                Résumé bullets for this job
              </h2>
              <CopyButton text={kit.bullets.map((b) => `- ${b}`).join('\n')} label="bullets" />
            </div>
            <ul className={styles.bullets}>
              {kit.bullets.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </section>

          {kit.keywordGaps.length > 0 ? (
            <section aria-labelledby="gaps-h">
              <h2 id="gaps-h" className="text-base font-semibold">
                Asked for, but not in your résumé
              </h2>
              <p className={styles.hint}>Add these only if they are true for you.</p>
              <ul className={styles.chips}>
                {kit.keywordGaps.map((g, i) => (
                  <li key={i} className={styles.chip}>
                    {g}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <p className={styles.hint}>
            Written by AI from your résumé. Read it and fix anything that is not accurate before you send it.
          </p>
        </>
      ) : null}
    </>
  )
}
