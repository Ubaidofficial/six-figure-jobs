'use client'

// The user's saved answers, each with Delete, and Delete all. Deleting only stops future pre-fills: applications already
// sent are not changed.
import * as React from 'react'
import { Trash2 } from 'lucide-react'

import styles from './autoapply.module.css'

type Row = { id: string; question: string; text: string; updated: string }

async function del(body: unknown): Promise<boolean> {
  const res = await fetch('/api/autoapply/answers', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null)
  return Boolean(res?.ok)
}

export function SavedAnswers({ initial }: { initial: Row[] }) {
  const [rows, setRows] = React.useState(initial)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [error, setError] = React.useState(false)

  const remove = async (id: string) => {
    setBusy(id)
    setError(false)
    if (await del({ id })) setRows((r) => r.filter((x) => x.id !== id))
    else setError(true)
    setBusy(null)
  }
  const removeAll = async () => {
    if (!window.confirm('Delete all your saved answers? Your next applications will start empty.')) return
    setBusy('*')
    setError(false)
    if (await del({ all: true })) setRows([])
    else setError(true)
    setBusy(null)
  }

  if (rows.length === 0) return <p className={styles.cardHint}>No saved answers. They appear here after you answer an employer&apos;s questions.</p>

  return (
    <>
      <div className={styles.answers}>
        {rows.map((r) => (
          <div key={r.id} className={styles.answer}>
            <div className={styles.answerBody}>
              <div className={styles.answerLabel}>{r.question}</div>
              <div className={styles.answerText}>{r.text}</div>
              <div className={styles.answerLabel} style={{ marginTop: 4, fontWeight: 400 }}>
                Last used {r.updated}
              </div>
            </div>
            <button type="button" className={styles.copy} onClick={() => void remove(r.id)} disabled={busy !== null} aria-label={`Delete saved answer: ${r.question}`}>
              <Trash2 aria-hidden /> Delete
            </button>
          </div>
        ))}
      </div>
      <div className={styles.cta}>
        <button type="button" className={styles.copy} onClick={() => void removeAll()} disabled={busy !== null}>
          <Trash2 aria-hidden /> Delete all saved answers
        </button>
        {error ? (
          <span role="alert" className={styles.err} style={{ marginTop: 0, alignSelf: 'center' }}>
            Could not delete. Try again.
          </span>
        ) : null}
      </div>
    </>
  )
}
