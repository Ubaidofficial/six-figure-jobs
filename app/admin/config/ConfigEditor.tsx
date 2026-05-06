'use client'
import { useState } from 'react'

type ConfigItem = { key: string; label: string; value: string }

export default function ConfigEditor({ configs: initial }: { configs: ConfigItem[] }) {
  const [configs, setConfigs] = useState(initial)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)

  async function save(key: string, value: string, label: string) {
    setSaving(key)
    const res = await fetch('/api/admin/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value, label }),
    })
    setSaving(null)
    if (res.ok) {
      setSaved(key)
      setTimeout(() => setSaved(null), 2000)
    }
  }

  const input: React.CSSProperties = {
    width: '100%', padding: '10px 14px', background: '#1a1a1a', border: '1px solid #2a2a2a',
    borderRadius: 8, color: '#fff', fontSize: 14, boxSizing: 'border-box', resize: 'vertical',
    fontFamily: 'inherit',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {configs.map((c) => (
        <div key={c.key} style={{ background: '#111', border: '1px solid #1f1f1f', borderRadius: 12, padding: '20px 24px' }}>
          <label style={{ display: 'block', fontWeight: 600, color: '#d4d4d4', marginBottom: 4 }}>{c.label}</label>
          <code style={{ fontSize: 11, color: '#555', display: 'block', marginBottom: 10 }}>{c.key}</code>
          <textarea
            rows={c.value.length > 80 ? 3 : 2}
            value={c.value}
            onChange={(e) => setConfigs((prev) => prev.map((x) => x.key === c.key ? { ...x, value: e.target.value } : x))}
            style={input}
          />
          <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              onClick={() => save(c.key, c.value, c.label)}
              disabled={saving === c.key}
              style={{
                padding: '7px 20px', background: '#84cc16', color: '#000', fontWeight: 700,
                border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 13,
              }}
            >
              {saving === c.key ? 'Saving...' : 'Save'}
            </button>
            {saved === c.key && <span style={{ color: '#84cc16', fontSize: 13 }}>✓ Saved</span>}
          </div>
        </div>
      ))}
    </div>
  )
}
