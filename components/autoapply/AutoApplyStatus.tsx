// The status pill and the four-step progress bar at the top of an auto-apply page. No state: safe on the server.
import { Ban, CheckCircle2, Clock, PenLine, Send, TriangleAlert, XCircle, type LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

import styles from './autoapply.module.css'

type Tone = 'neutral' | 'progress' | 'success' | 'warning' | 'error'

export const STATUS_VIEW: Record<string, { label: string; tone: Tone; Icon: LucideIcon }> = {
  draft: { label: 'Draft: review and approve', tone: 'neutral', Icon: PenLine },
  approved: { label: 'Queued', tone: 'progress', Icon: Clock },
  submitting: { label: 'Sending now', tone: 'progress', Icon: Send },
  submitted: { label: 'Submitted', tone: 'success', Icon: CheckCircle2 },
  needs_user: { label: 'Needs you to finish', tone: 'warning', Icon: TriangleAlert },
  failed: { label: 'Not sent', tone: 'error', Icon: XCircle },
  cancelled: { label: 'Cancelled', tone: 'neutral', Icon: Ban },
}

export const toneClass = (tone: Tone) => styles[`tone-${tone}`]

export function StatusPill({ status }: { status: string }) {
  const v = STATUS_VIEW[status] ?? STATUS_VIEW.draft
  return (
    <span className={cn(styles.pill, toneClass(v.tone))}>
      <v.Icon aria-hidden />
      {v.label}
    </span>
  )
}

const STEPS = [
  { title: 'Review', text: 'Check every answer' },
  { title: 'Approve', text: 'You say go' },
  { title: 'Send', text: 'We fill their form' },
  { title: 'Confirmed', text: 'Employer says received' },
]

/** Which step an application is on (0-3), and whether it stopped there. */
function position(status: string): { at: number; stuck: boolean } {
  switch (status) {
    case 'draft': return { at: 0, stuck: false }
    case 'approved': return { at: 1, stuck: false }
    case 'submitting': return { at: 2, stuck: false }
    case 'submitted': return { at: 4, stuck: false }
    case 'needs_user':
    case 'failed': return { at: 2, stuck: true }
    default: return { at: -1, stuck: false } // cancelled
  }
}

export function ApplySteps({ status }: { status: string }) {
  const { at, stuck } = position(status)
  return (
    <ol className={styles.steps} aria-label="Progress">
      {STEPS.map((s, i) => {
        const done = i < at
        const now = i === at
        return (
          <li
            key={s.title}
            className={cn(styles.step, done && styles.stepDone, now && (stuck ? styles.stepStuck : styles.stepNow))}
            aria-current={now ? 'step' : undefined}
          >
            <b>{now && stuck ? 'Stopped here' : s.title}</b>
            <span>{now && stuck ? 'Handed back to you' : s.text}</span>
          </li>
        )
      })}
    </ol>
  )
}
