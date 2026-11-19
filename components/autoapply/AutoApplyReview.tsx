'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'

import { Check, CheckCircle2, Circle, FileText, Mail, ShieldCheck } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { Plan, PlanField } from '@/lib/autoapply/plan'
import { cn } from '@/lib/utils'

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

  const profileInput = (k: keyof Profile, label: string, required = false, type = 'text', autoComplete?: string) => (
    <label className={styles.q}>
      <span className={styles.qLabel}>
        {label} {required ? null : <span className={styles.opt}>Optional</span>}
      </span>
      <input
        className={styles.input}
        type={type}
        value={profile[k]}
        autoComplete={autoComplete}
        onChange={(e) => setProfileField(k, e.target.value)}
        maxLength={300}
      />
    </label>
  )

  // Live progress for the checklist; approval itself still goes by the saved plan (`canApprove`).
  const questions = plan.fields.filter(isAnswer)
  const requiredQs = questions.filter((f) => f.required)
  const answeredQs = requiredQs.filter((f) => !blank(answers[f.key] ?? null)).length
  const detailsOk = [profile.firstName, profile.lastName, profile.phone].every((v) => v.trim() !== '')
  const Tick = ({ ok }: { ok: boolean }) => (ok ? <CheckCircle2 aria-hidden className={styles.ok} /> : <Circle aria-hidden className={styles.todo} />)

  return (
    <div className={styles.layout}>
      <div className={styles.main}>
        <section className={styles.card} aria-labelledby="details-h">
          <div className={styles.cardHead}>
            <span className={cn(styles.num, detailsOk && styles.numDone)}>{detailsOk ? <Check size={16} aria-hidden /> : 1}</span>
            <div>
              <h2 id="details-h" className={styles.cardTitle}>
                Your details
              </h2>
              <p className={styles.cardHint}>Saved for your next applications too. Email: {props.email}</p>
            </div>
          </div>
          <div className={styles.grid2}>
            {profileInput('firstName', 'First name', true, 'text', 'given-name')}
            {profileInput('lastName', 'Last name', true, 'text', 'family-name')}
            {profileInput('phone', 'Phone', true, 'tel', 'tel')}
            {profileInput('country', 'Country', false, 'text', 'country-name')}
            {profileInput('city', 'City', false, 'text', 'address-level2')}
            {profileInput('linkedin', 'LinkedIn URL', false, 'url')}
            {profileInput('website', 'Website URL', false, 'url')}
            {profileInput('github', 'GitHub URL', false, 'url')}
          </div>
        </section>

        <section className={styles.card} aria-labelledby="q-h">
          <div className={styles.cardHead}>
            <span className={cn(styles.num, answeredQs === requiredQs.length && styles.numDone)}>
              {answeredQs === requiredQs.length ? <Check size={16} aria-hidden /> : 2}
            </span>
            <div>
              <h2 id="q-h" className={styles.cardTitle}>
                The employer&apos;s questions
              </h2>
              <p className={styles.cardHint}>Straight from their application form. Answer them as you would there.</p>
            </div>
            {requiredQs.length > 0 ? (
              <span className={styles.count}>
                {answeredQs} of {requiredQs.length} required
              </span>
            ) : null}
          </div>
          <p className={styles.note}>
            <ShieldCheck aria-hidden />
            <span>
              These are yours to answer. We never guess, and we never answer work authorization, clearance, sponsorship or
              similar questions for you.
            </span>
          </p>
          {questions.length === 0 ? <p className={styles.cardHint}>This employer asks nothing beyond your details.</p> : null}
          {questions.map((f) => {
            const v = answers[f.key]
            const bad = errors[f.key] ? true : undefined
            const done = !blank(v ?? null)
            return (
              <div key={f.key} className={styles.q}>
                <label className={styles.qLabel} htmlFor={`a-${f.key}`}>
                  {done ? <CheckCircle2 aria-hidden /> : null}
                  <span>{f.label}</span>
                  {f.required ? <span className={styles.req}>Required</span> : <span className={styles.opt}>Optional</span>}
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
                  <div id={`a-${f.key}`} className={styles.choices}>
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
            <div className={styles.choices} style={{ marginTop: 'var(--space-20)' }}>
              <label className={styles.check}>
                <input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); setDirty(true) }} />
                I consent to this employer processing my application data, as they ask.
              </label>
            </div>
          ) : null}
        </section>

        <section className={styles.card} aria-labelledby="sent-h">
          <div className={styles.cardHead}>
            <span className={styles.num}>3</span>
            <div>
              <h2 id="sent-h" className={styles.cardTitle}>
                Sent with it
              </h2>
              <p className={styles.cardHint}>Attached to the employer&apos;s form exactly as approved.</p>
            </div>
          </div>
          <div className={styles.sent}>
            <div className={styles.sentItem}>
              <span className={styles.sentIcon}><FileText aria-hidden /></span>
              <div>
                <div className={styles.sentName}>Résumé</div>
                <div className={styles.sentText}>A PDF made from your saved résumé: {props.resumePreview}</div>
              </div>
            </div>
            <div className={styles.sentItem}>
              <span className={styles.sentIcon}><Mail aria-hidden /></span>
              <div>
                <div className={styles.sentName}>Cover letter</div>
                <div className={styles.sentText}>
                  {props.hasCoverLetter ? 'The one from your application kit for this job.' : 'None. Make a kit for this job first if you want one.'}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <aside className={styles.aside} aria-label="Ready to approve">
        <div className={styles.card}>
          <h2 className={styles.sumTitle}>Ready to approve?</h2>
          <ul className={styles.checklist}>
            <li><Tick ok={detailsOk} /> Your name and phone</li>
            <li>
              <Tick ok={answeredQs === requiredQs.length} />
              {requiredQs.length === 0 ? 'No required questions' : `Required questions: ${answeredQs} of ${requiredQs.length}`}
            </li>
            {plan.needsConsent ? <li><Tick ok={consent} /> The employer&apos;s consent</li> : null}
            <li><Tick ok={!dirty} /> {dirty ? 'Changes not saved yet' : 'Everything saved'}</li>
            <li><Tick ok={enough} /> {enough ? `Credits: you have ${props.balance}` : `Credits: you have ${props.balance}, need ${props.cost}`}</li>
          </ul>
          <div className={styles.price}>
            <span>Price if it goes through</span>
            <span>
              <strong>{props.cost}</strong> {plural}
            </span>
          </div>
          <div className={styles.actions}>
            {dirty ? (
              <Button loading={busy === 'save'} disabled={busy !== null} onClick={() => void save()}>
                Save changes
              </Button>
            ) : (
              <Button loading={busy === 'approve'} disabled={!canApprove} onClick={() => void approve()}>
                Approve and queue
              </Button>
            )}
            <Button variant="tertiary" loading={busy === 'cancel'} disabled={busy !== null} onClick={() => void cancel()}>
              Cancel application
            </Button>
          </div>
          {message ? (
            <p role="status" className={styles.status}>
              {message}
            </p>
          ) : null}
          {!canApprove && !dirty ? (
            <p className={styles.blocker}>
              {missing.length > 0
                ? `${missing.length} required ${missing.length === 1 ? 'answer is' : 'answers are'} still missing.`
                : !consentOk
                  ? 'Tick the employer\'s consent to continue.'
                  : !enough
                    ? `You need ${props.cost} ${plural} to approve.`
                    : null}
            </p>
          ) : null}
        </div>
        <div className={styles.guarantee}>
          <ShieldCheck aria-hidden />
          <div>
            <strong>Charged only when the employer confirms.</strong>A captcha, a security code, a question we do not
            recognise or no confirmation: we stop, charge nothing, and hand it back to you with their link.
          </div>
        </div>
      </aside>
    </div>
  )
}
