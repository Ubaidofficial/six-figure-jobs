'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MessageSquare, X, Send, Paperclip, CheckCircle, AlertCircle } from 'lucide-react'
import styles from './FeedbackWidget.module.css'

type Status = 'idle' | 'sending' | 'success' | 'error'

const ISSUE_TYPES = [
  { value: 'bug', label: '🐛 Bug report' },
  { value: 'broken-link', label: '🔗 Broken link' },
  { value: 'wrong-salary', label: '💰 Wrong salary' },
  { value: 'wrong-logo', label: '🏢 Wrong company info' },
  { value: 'suggestion', label: '💡 Suggestion' },
  { value: 'other', label: '📝 Other' },
]

export function FeedbackWidget() {
  const [open, setOpen] = useState(false)
  // Phones: the button slides out of the way while the page scrolls down (reading) and comes back on scroll up or
  // near the top, so it is never parked over the text being read. Desktop ignores this (see the CSS).
  const [tucked, setTucked] = useState(false)
  const [type, setType] = useState('bug')
  const [message, setMessage] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const pasteAreaRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let lastY = window.scrollY
    let run = 0 // pixels scrolled in the current direction (positive = down)
    let frame = 0
    const update = () => {
      frame = 0
      const y = window.scrollY
      const dy = y - lastY
      lastY = y
      if (y < 120) {
        run = 0
        setTucked(false)
        return
      }
      run = Math.sign(dy) === Math.sign(run) ? run + dy : dy
      if (run > 24) setTucked(true)
      else if (run < -8) setTucked(false)
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData.items
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (!file) continue
        void shrinkScreenshot(file).then(setScreenshot).catch(() => setScreenshot(null))
        e.preventDefault()
        break
      }
    }
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!message.trim()) return

    setStatus('sending')
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          message: message.trim(),
          screenshot,
          url: window.location.href,
        }),
      })
      if (!res.ok) throw new Error('Failed')
      setStatus('success')
      setTimeout(() => {
        setOpen(false)
        setStatus('idle')
        setMessage('')
        setScreenshot(null)
        setType('bug')
      }, 2000)
    } catch {
      setStatus('error')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        className={`${styles.toggle} ${open ? styles.toggleHidden : ''} ${tucked ? styles.toggleTucked : ''}`}
        onClick={() => setOpen(true)}
        aria-label="Send feedback"
      >
        <MessageSquare className={styles.toggleIcon} aria-hidden="true" />
        <span className={styles.toggleLabel}>Feedback</span>
      </button>

      {/* Modal */}
      {open && (
        <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="Send feedback">
          <div className={styles.panel}>
            {/* Header */}
            <div className={styles.panelHeader}>
              <div className={styles.panelTitle}>
                <MessageSquare className={styles.panelTitleIcon} aria-hidden="true" />
                Send Feedback
              </div>
              <button
                type="button"
                className={styles.close}
                onClick={() => setOpen(false)}
                aria-label="Close feedback"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success state */}
            {status === 'success' ? (
              <div className={styles.successState}>
                <CheckCircle className={styles.successIcon} />
                <p className={styles.successText}>Thanks! We&apos;ve received your feedback.</p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                {/* Issue type */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="fb-type">Issue type</label>
                  <select
                    id="fb-type"
                    className={styles.select}
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    {ISSUE_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>

                {/* Message */}
                <div className={styles.field}>
                  <label className={styles.label} htmlFor="fb-msg">Description</label>
                  <textarea
                    id="fb-msg"
                    className={styles.textarea}
                    rows={4}
                    placeholder="Describe the issue or suggestion…"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    required
                    minLength={10}
                  />
                </div>

                {/* Screenshot paste area */}
                <div className={styles.field}>
                  <label className={styles.label}>
                    <Paperclip className="inline w-3 h-3 mr-1" aria-hidden="true" />
                    Screenshot (paste with Ctrl+V / ⌘+V)
                  </label>
                  <div
                    ref={pasteAreaRef}
                    className={`${styles.pasteArea} ${screenshot ? styles.pasteAreaFilled : ''}`}
                    onPaste={handlePaste}
                    tabIndex={0}
                    role="button"
                    aria-label="Paste screenshot here"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') pasteAreaRef.current?.focus()
                    }}
                  >
                    {screenshot ? (
                      <div className={styles.screenshotWrap}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={screenshot} alt="Pasted screenshot" className={styles.screenshot} />
                        <button
                          type="button"
                          className={styles.removeScreenshot}
                          onClick={() => setScreenshot(null)}
                          aria-label="Remove screenshot"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ) : (
                      <span className={styles.pastePlaceholder}>
                        Click here, then paste a screenshot
                      </span>
                    )}
                  </div>
                </div>

                {/* Error */}
                {status === 'error' && (
                  <div className={styles.errorMsg}>
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    Failed to send. Please try again.
                  </div>
                )}

                {/* Submit */}
                <div className={styles.actions}>
                  <span className={styles.pageUrl}>{typeof window !== 'undefined' ? window.location.pathname : ''}</span>
                  <button
                    type="submit"
                    className={styles.submit}
                    disabled={status === 'sending' || !message.trim()}
                  >
                    {status === 'sending' ? (
                      'Sending…'
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" aria-hidden="true" />
                        Send
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}

/** A pasted screenshot as a JPEG data URL at most 1600px wide (a full-resolution PNG can be several MB). */
function shrinkScreenshot(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 1600 / img.naturalWidth)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.naturalWidth * scale)
      canvas.height = Math.round(img.naturalHeight * scale)
      const ctx = canvas.getContext('2d')
      URL.revokeObjectURL(url)
      if (!ctx) return reject(new Error('no canvas'))
      ctx.fillStyle = '#fff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.82))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('not an image'))
    }
    img.src = url
  })
}
