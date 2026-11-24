'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

import s from '../../admin.module.css'
import { endOfDayUtc, httpsUrl } from '../../../../lib/sponsors/slotRules'

export type SlotValues = { name: string; text: string; url: string; logo: string; until: string }

/** Why a slot would not show, in the order the site checks (lib/sponsors/slots.ts buildSponsorSlots). */
function state(v: SlotValues): { tone: 'ok' | 'warn' | 'muted'; text: string } {
  if (!v.name && !v.url && !v.until) return { tone: 'muted', text: 'Empty' }
  if (!v.name.trim()) return { tone: 'warn', text: 'Not shown: no name' }
  if (!httpsUrl(v.url)) return { tone: 'warn', text: 'Not shown: the link must start with https://' }
  const end = endOfDayUtc(v.until)
  if (!end) return { tone: 'warn', text: 'Not shown: last day must be YYYY-MM-DD' }
  if (end.getTime() < Date.now()) return { tone: 'muted', text: `Ended ${v.until}` }
  const days = Math.ceil((end.getTime() - Date.now()) / 86_400_000)
  return { tone: 'ok', text: `Showing until ${v.until} (${days} day${days === 1 ? '' : 's'} left)` }
}

export default function SponsorSlotForm({ id, initial, liveHref }: { id: number; initial: SlotValues; liveHref: string | null }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const dirty = (Object.keys(v) as Array<keyof SlotValues>).some((k) => v[k] !== initial[k])
  const st = state(v)

  async function save(values: SlotValues) {
    setSaving(true)
    setMsg(null)
    // A network failure used to throw here and leave the button stuck on "saving" with no message.
    try {
      const res = await fetch('/api/ubaid93/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ values: Object.fromEntries(Object.entries(values).map(([k, val]) => [`sponsor.${id}.${k}`, val])) }),
      })
      if (res.ok) {
        setMsg('Saved')
        router.refresh()
      } else {
        const body = (await res.json().catch(() => null)) as { error?: string } | null
        setMsg(`Could not save: ${body?.error ?? `HTTP ${res.status}`}`)
      }
    } catch {
      setMsg('Could not save: no connection to the server')
    } finally {
      setSaving(false)
    }
  }

  const field = (key: keyof SlotValues, label: string, hint?: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label className={s.field}>
      <span>
        {label}
        {hint ? <span className={s.checkDetail}>{hint}</span> : null}
      </span>
      <input className={s.input} value={v[key]} onChange={(e) => setV({ ...v, [key]: e.target.value })} {...props} />
    </label>
  )

  return (
    <section className={`${s.panel} ${s.panelPad}`}>
      <h2 className={s.sectionTitle}>
        Slot {id}
        <span className={`${s.status} ${s[st.tone]}`} style={{ fontFamily: 'var(--font-body)', fontWeight: 400 }}>
          {st.text}
        </span>
      </h2>
      {field('name', 'Sponsor name', 'up to 60 characters', { maxLength: 60 })}
      {field('text', 'One line of text', 'up to 140 characters', { maxLength: 140 })}
      {field('url', 'Link', 'https only', { type: 'url', placeholder: 'https://' })}
      {field('logo', 'Logo image link', 'https, optional; initials otherwise', { type: 'url', placeholder: 'https://' })}
      {field('until', 'Last day shown', 'UTC', { type: 'date' })}
      {liveHref ? (
        <p className={s.cellSub} style={{ wordBreak: 'break-all' }}>
          Visitors go to {liveHref}
        </p>
      ) : null}
      <div className={s.toolbar} style={{ margin: '8px 0 0', justifyContent: 'space-between' }}>
        <button
          className={`${s.btn} ${s.btnDanger}`}
          disabled={saving || (!initial.name && !initial.url && !initial.until)}
          onClick={() => {
            if (!window.confirm(`Clear slot ${id}? It stops showing within about 15 minutes.`)) return
            const empty = { name: '', text: '', url: '', logo: '', until: '' }
            setV(empty)
            void save(empty)
          }}
        >
          Clear slot
        </button>
        <span className={s.actions}>
          {msg ? <span className={s.dim}>{msg}</span> : null}
          <button className={`${s.btn} ${s.btnPrimary}`} disabled={!dirty || saving} onClick={() => save(v)}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </span>
      </div>
    </section>
  )
}
