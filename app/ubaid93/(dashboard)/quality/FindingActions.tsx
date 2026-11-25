'use client'
import s from '../../admin.module.css'
import { ActionError, useAction } from '../useAction'

/** "Won't fix" for an open finding (agents then leave it alone), "Reopen" for one marked so. */
export default function FindingActions({ findingKey, status }: { findingKey: string; status: string }) {
  const { busy, failed, run } = useAction()
  if (status === 'fixed') return null
  const wontfix = status !== 'wontfix'
  return (
    <div className={s.actions}>
      <button
        className={s.btn}
        disabled={busy === findingKey}
        onClick={() => {
          if (wontfix && !window.confirm('Mark this finding "won\'t fix"? The quality agents will leave it alone until you reopen it.')) return
          run(findingKey, '/api/ubaid93/quality', { key: findingKey, status: wontfix ? 'wontfix' : 'open' })
        }}
      >
        {wontfix ? "Won't fix" : 'Reopen'}
      </button>
      <ActionError message={failed} />
    </div>
  )
}
