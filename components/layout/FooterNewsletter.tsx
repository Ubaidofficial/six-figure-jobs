'use client'

import * as React from 'react'

import styles from './FooterNewsletter.module.css'

export function FooterNewsletter() {
  const [email, setEmail] = React.useState('')
  const [status, setStatus] = React.useState<'idle' | 'success' | 'error'>('idle')

  return (
    <form
      className={styles.form}
      onSubmit={(e) => {
        e.preventDefault()
        const value = email.trim()
        const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
        if (!ok) {
          setStatus('error')
          return
        }
        setStatus('success')
        try {
          window.localStorage.setItem('sfj_newsletter_email', value)
        } catch {
          // ignore
        }
      }}
    >
      <label className={styles.srOnly} htmlFor="footer-newsletter-email">
        Email address
      </label>
      <input
        id="footer-newsletter-email"
        className={styles.input}
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="you@company.com"
        value={email}
        onChange={(e) => {
          setEmail(e.target.value)
          if (status !== 'idle') setStatus('idle')
        }}
        aria-invalid={status === 'error'}
      />
      <button className={styles.button} type="submit">
        Subscribe
      </button>

      <div className={styles.message} aria-live="polite">
        {status === 'error' ? 'Enter a valid email.' : status === 'success' ? 'Subscribed (saved on this device).' : ''}
      </div>
    </form>
  )
}

