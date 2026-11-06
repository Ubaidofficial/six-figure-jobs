'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import type { Plan, PlanField } from '@/lib/autoapply/plan'

import kit from '../applykit/applykit.module.css'
import styles from './autoapply.module.css'

type Profile = { firstName: string; lastName: string; phone: string; country: string; city: string; linkedin: string; website: string; github: string }

export type ReviewProps = {
  id: string
  plan: Plan
  hash: string
  profile: Profile
  email: string
  resumePreview: string
  hasCoverLetter: boolean
  cost: number
  balance: number
}

const MESSAGES: Record<string, string> = {
  incomplete: 'Some required answers are still missing.',
  consent_required: 'The employer needs your consent before you can apply.',
  changed: 'This application changed since you last saved it. Save, review and approve again.',
  insufficient_credits: 'You do not have enough credits.',
  daily_limit: 'You have reached the daily limit of applications.',
  not_editable: 'This application can no longer be edited.',
  invalid: 'Some details are not valid. Links must start with https://.',
  rate_limited: 'Too many attempts. Wait a few minutes and try again.',
}

const isAnswer = (f: PlanField) => f.source === 'user'
const blank = (v: PlanField['value']) => v == null || (Array.isArray(v) ? v.length === 0 : v.trim() === '')

export function AutoApplyReview(props: ReviewProps) {
  const router = useRouter()
  const [plan, setPlan] = React.useState(props.plan)
  const [hash, setHash] = React.useState(props.hash)
  const [profile, setProfile] = React.useState(props.profile)
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>(() =>
    Object.fromEntries(props.plan.fields.filter(isAnswer).map((f) => [f.key, f.value ?? (f.type === 'multi' ? [] : '')])),
  )
  const [consent, setConsent] = React.useState(props.plan.consentGiven)
  const [dirty, setDirty] = React.useState(false)
  const [busy, setBusy] = React.useState<'save' | 'approve' | 'cancel' | null>(null)
  const [errors, setErrors] = React.useState<Record<string, string>>({})
  const [message, setMessage] = React.useState<string | null>(null)

  const missing = plan.fields.filter((f) => f.required && blank(f.value))
  const consentOk = !plan.needsConsent || plan.consentGiven
  const enough = props.balance >= props.cost
  const canApprove = !dirty && missing.length === 0 && consentOk && enough && busy === null

  async function call(path: string, method: string, body: unknown) {
    const res = await fetch(path, { method, credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const data = (await res.json().catch(() => ({}))) as Record<string, any>
    if (res.status === 401) window.location.assign('/sign-in')
    return { ok: res.ok, data }
  }

  async function save() {
    setBusy('save')
    setMessage(null)
    try {
      const { ok, data } = await call('/api/autoapply/draft', 'PATCH', { id: props.id, profile, answers, consent })
      if (ok) {
        setPlan(data.plan)
        setHash(data.hash)
        setErrors(data.errors ?? {})
        setDirty(false)
        setMessage(Object.keys(data.errors ?? {}).length ? 'Saved, but some answers were not accepted.' : 'Saved.')
      } else setMessage(MESSAGES[data.error] ?? 'Could not save. Please try again.')
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    }
    setBusy(null)
  }

  async function approve() {
    setBusy('approve')
    setMessage(null)
    try {
      const { ok, data } = await call('/api/autoapply/approve', 'POST', { id: props.id, hash })
      if (ok) return router.refresh()
      setMessage(MESSAGES[data.error] ?? 'Could not approve. Please try again.')
    } catch {
      setMessage('Could not reach the server. Check your connection and try again.')
    }
    setBusy(null)
  }

  async function cancel() {
    setBusy('cancel')
    const { ok } = await call('/api/autoapply/cancel', 'POST', { id: props.id }).catch(() => ({ ok: false }))
    if (ok) return router.refresh()
    setBusy(null)
  }

  const setAnswer = (key: string, v: string | string[]) => {
    setAnswers((a) => ({ ...a, [key]: v }))
    setDirty(true)
  }
  const setProfileField = (k: keyof Profile, v: string) => {
    setProfile((p) => ({ ...p, [k]: v }))
    setDirty(true)
  }
  const plural = props.cost === 1 ? 'credit' : 'credits'

  const profileInput = (k: keyof Profile, label: string, required = false, type = 'text') => (
    <label className={styles.q}>
      <span className={styles.qLabel}>
        {label} {required ? null : <span className={styles.req}>(optional)</span>}
      </span>
      <input className={styles.input} type={type} value={profile[k]} onChange={(e) => setProfileField(k, e.target.value)} maxLength={300} />
    </label>
  )

  return (
    <>
      <section aria-labelledby="details-h">
        <h2 id="details-h" className="text-base font-semibold">
          Your details
        </h2>
        <p className={kit.hint}>Used on this and later applications. The email is your account email: {props.email}.</p>
        <div className={styles.grid2}>
          {profileInput('firstName', 'First name', true)}
          {profileInput('lastName', 'Last name', true)}
          {profileInput('phone', 'Phone', true, 'tel')}
          {profileInput('country', 'Country')}
          {profileInput('city', 'City')}
          {profileInput('linkedin', 'LinkedIn URL', false, 'url')}
          {profileInput('website', 'Website URL', false, 'url')}
          {profileInput('github', 'GitHub URL', false, 'url')}
        </div>
      </section>

      <section aria-labelledby="q-h">
        <h2 id="q-h" className="text-base font-semibold">
          The employer&apos;s questions
        </h2>
        <p className={kit.hint}>
          These are yours to answer. We never guess, and we never answer questions about work authorization, clearance,
          sponsorship or similar for you.
        </p>
        {plan.fields.filter(isAnswer).length === 0 ? <p className={kit.hint}>This employer asks nothing beyond your details.</p> : null}
        {plan.fields.filter(isAnswer).map((f) => {
          const v = answers[f.key]
          const bad = errors[f.key] ? true : undefined
          return (
            <div key={f.key} className={styles.q}>
              <label className={styles.qLabel} htmlFor={`a-${f.key}`}>
                {f.label} {f.required ? <span className={styles.req}>(required)</span> : <span className={styles.req}>(optional)</span>}
              </label>
              {f.type === 'single' ? (
                <select id={`a-${f.key}`} className={styles.input} aria-invalid={bad} value={(v as string) ?? ''} onChange={(e) => setAnswer(f.key, e.target.value)}>
                  <option value="">Choose…</option>
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              ) : f.type === 'multi' ? (
                <div id={`a-${f.key}`}>
                  {f.options?.map((o) => (
                    <label key={o.value} className={styles.check}>
                      <input
                        type="checkbox"
                        checked={((v as string[]) ?? []).includes(o.value)}
                        onChange={(e) => {
                          const cur = (v as string[]) ?? []
                          setAnswer(f.key, e.target.checked ? [...cur, o.value] : cur.filter((x) => x !== o.value))
                        }}
                      />
                      {o.label}
                    </label>
                  ))}
                </div>
              ) : f.type === 'textarea' ? (
                <textarea id={`a-${f.key}`} className={styles.input} aria-invalid={bad} rows={4} maxLength={5000} value={(v as string) ?? ''} onChange={(e) => setAnswer(f.key, e.target.value)} />
              ) : (
                <input id={`a-${f.key}`} className={styles.input} aria-invalid={bad} maxLength={500} value={(v as string) ?? ''} onChange={(e) => setAnswer(f.key, e.target.value)} />
              )}
              {errors[f.key] ? <p className={styles.err}>That answer was not accepted.</p> : null}
            </div>
          )
        })}
        {plan.needsConsent ? (
          <label className={styles.check}>
            <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setDirty(true) }} />
            I consent to this employer processing my application data, as they ask.
          </label>
        ) : null}
      </section>

      <section aria-labelledby="sent-h">
        <h2 id="sent-h" className="text-base font-semibold">
          Also sent with it
        </h2>
        <dl className={styles.sent}>
          <dt>Résumé</dt>
          <dd>A PDF made from your saved résumé: {props.resumePreview}</dd>
          <dt>Cover letter</dt>
          <dd>{props.hasCoverLetter ? 'The one from your application kit for this job.' : 'None. Make a kit for this job first if you want one.'}</dd>
        </dl>
      </section>

      <div className={styles.terms}>
        <strong>
          This costs {props.cost} {plural}, taken only if the employer confirms your application.
        </strong>{' '}
        If the employer&apos;s site asks for a captcha or a security code, shows a question we do not recognise, or we cannot
        confirm it went through, we stop, charge nothing, and give you the employer&apos;s own link to finish yourself. You have {props.balance}.
      </div>

      <div className={kit.row}>
        <Button variant="secondary" loading={busy === 'save'} disabled={!dirty || busy !== null} onClick={() => void save()}>
          Save
        </Button>
        <Button loading={busy === 'approve'} disabled={!canApprove} onClick={() => void approve()}>
          Approve and queue
        </Button>
        <Button variant="tertiary" loading={busy === 'cancel'} disabled={busy !== null} onClick={() => void cancel()}>
          Cancel
        </Button>
        {message ? (
          <span role="status" className={kit.small}>
            {message}
          </span>
        ) : null}
      </div>
      {!canApprove ? (
        <p className={kit.hint}>
          {dirty
            ? 'Save your changes, then review and approve.'
            : missing.length > 0
              ? `${missing.length} required ${missing.length === 1 ? 'answer is' : 'answers are'} still missing.`
              : !consentOk
                ? 'Tick the employer\'s consent to continue.'
                : !enough
                  ? `You need ${props.cost} ${plural} to approve.`
                  : null}
        </p>
      ) : null}
    </>
  )
}
