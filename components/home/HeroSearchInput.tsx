'use client'

// components/home/HeroSearchInput.tsx
// The homepage search box with live role suggestions ("seo" -> SEO Manager, SEO Specialist, each with its job count).
// It is still a plain text input named `q` inside the hero's GET form: without JavaScript, or if the suggestion
// request fails, the box searches exactly as before. Built as an ARIA combobox so keyboard and screen-reader users get
// the same suggestions: arrow keys move, Enter opens the highlighted role, Escape closes.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import styles from './HeroSearchInput.module.css'

type Suggestion = { slug: string; label: string; count: number }

const MIN_CHARS = 2
const DEBOUNCE_MS = 150

export function HeroSearchInput({
  id,
  name,
  placeholder,
  className,
}: {
  id: string
  name: string
  placeholder: string
  className?: string
}) {
  const router = useRouter()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [value, setValue] = useState('')
  const [items, setItems] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  useEffect(() => {
    const q = value.trim()
    if (q.length < MIN_CHARS) {
      setItems([])
      setOpen(false)
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs/suggest?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        if (!res.ok) return
        const data = (await res.json()) as { suggestions?: Suggestion[] }
        const next = Array.isArray(data.suggestions) ? data.suggestions : []
        setItems(next)
        setActive(-1)
        setOpen(next.length > 0)
      } catch {
        // aborted by the next keystroke, or offline: keep whatever the box showed, the search itself still works
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value])

  const hrefFor = (s: Suggestion) => `/jobs?role=${encodeURIComponent(s.slug)}`
  const rows = items.length + 1 // the roles, then "search all jobs for …"

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' && items.length > 0) {
        e.preventDefault()
        setOpen(true)
        setActive(0)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % rows)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? rows - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    } else if (e.key === 'Enter' && active >= 0 && active < items.length) {
      e.preventDefault() // a highlighted role opens its jobs; with nothing highlighted Enter searches the text as usual
      setOpen(false)
      router.push(hrefFor(items[active]))
    }
  }

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onBlur={(e) => {
        if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setOpen(false)
      }}
    >
      <input
        id={id}
        name={name}
        type="text"
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => items.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      />
      <span className={styles.srOnly} role="status">
        {open ? `${items.length} role ${items.length === 1 ? 'suggestion' : 'suggestions'} available` : ''}
      </span>
      {open ? (
        <ul id={listId} role="listbox" aria-label="Role suggestions" className={styles.list}>
          {items.map((s, i) => (
            <li key={s.slug} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={styles.option} data-active={i === active}>
              <Link
                href={hrefFor(s)}
                prefetch={false}
                tabIndex={-1}
                className={styles.link}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the input so blur does not close the list first
                onClick={() => setOpen(false)}
              >
                <span className={styles.label}>{s.label}</span>
                <span className={styles.count}>
                  {s.count.toLocaleString()} {s.count === 1 ? 'job' : 'jobs'}
                </span>
              </Link>
            </li>
          ))}
          <li
            id={`${listId}-${items.length}`}
            role="option"
            aria-selected={active === items.length}
            className={`${styles.option} ${styles.all}`}
            data-active={active === items.length}
          >
            {/* No onClick that closes the list: unmounting this button during the click would cancel the submit. The page navigates. */}
            <button type="submit" tabIndex={-1} className={styles.link} onMouseDown={(e) => e.preventDefault()}>
              <span className={styles.label}>
                Search all jobs for &ldquo;{value.trim()}&rdquo;
              </span>
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  )
}
