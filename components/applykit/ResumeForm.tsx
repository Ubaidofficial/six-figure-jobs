'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

import styles from './applykit.module.css'

const MESSAGES: Record<string, string> = {
  resume_too_short: 'That looks too short to be a résumé. Paste the full text.',
  resume_too_long: 'That is too long. Keep it under 20,000 characters.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
}

export function ResumeForm({ initialText }: { initialText: string }) {
  const router = useRouter()
  const [text, setText] = React.useState(initialText)
  const [busy, setBusy] = React.useState<'save' | 'delete' | null>(null)
  const [message, setMessage] = React.useState<{ ok: boolean; text: string } | null>(null)

  async function call(method: 'PUT' | 'DELETE') {
    setBusy(method === 'PUT' ? 'save' : 'delete')
    setMessage(null)
    try {
      const res = await fetch('/api/kit/resume', {
        method,
        credentials: 'same-origin',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(method === 'PUT' ? { text } : {}),
      })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.status === 401) return window.location.assign('/sign-in?callbackUrl=%2Faccount%2Fapplications')
      if (res.ok) {
        if (method === 'DELETE') setText('')
        setMessage({ ok: true, text: method === 'PUT' ? 'Résumé saved.' : 'Résumé deleted.' })
        router.refresh()
      } else {
        setMessage({ ok: false, text: MESSAGES[data.error ?? ''] ?? 'Something went wrong. Please try again.' })
      }
    } catch {
      setMessage({ ok: false, text: 'Could not reach the server. Check your connection and try again.' })
    }
    setBusy(null)
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void call('PUT')
      }}
    >
      <label className={styles.field}>
        <span className={styles.label}>Your résumé (plain text)</span>
        <textarea
          className={styles.textarea}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={20000}
          spellCheck={false}
          placeholder="Paste your résumé here: experience, skills, education."
        />
      </label>
      <p className={styles.hint}>
        Only you can see it. It is sent to our AI provider when you create a kit, and nowhere else. Delete it any time.
      </p>
      <div className={styles.row}>
        <Button type="submit" loading={busy === 'save'} disabled={busy !== null}>
          Save résumé
        </Button>
        {initialText ? (
          <Button variant="tertiary" loading={busy === 'delete'} disabled={busy !== null} onClick={() => void call('DELETE')}>
            Delete résumé
          </Button>
        ) : null}
        {message ? (
          <span role={message.ok ? 'status' : 'alert'} className={styles.small}>
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  )
}
