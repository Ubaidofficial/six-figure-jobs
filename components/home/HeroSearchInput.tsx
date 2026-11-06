'use client'

// components/home/HeroSearchInput.tsx
// The homepage search box with instant results: as you type, the best matching jobs (title, company, pay) and how many
// match in all, from the same keyword search the Search button runs, using the salary and work arrangement chosen in the
// form so the total is what the button would show. It is still a plain text input named `q` inside the hero's GET form:
// without JavaScript, or if the request fails, the box searches as before. Built as an ARIA combobox: arrow keys move
// (wrapping), Enter opens the highlighted job, Escape closes. When a role, location or remote region is chosen the
// box shows no instant results (they are not filtered by those), and Search applies everything as usual.

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import styles from './HeroSearchInput.module.css'

type Job = { title: string; company: string; pay: string | null; href: string }
type Results = { query: string; total: number; jobs: Job[] }

const MIN_CHARS = 2
const DEBOUNCE_MS = 150
// Form fields the instant results are not filtered by: with one of these set, the list would not match the search.
const UNFILTERED_FIELDS = ['role', 'country', 'remoteRegion']

/** What to send along with the typed text, or null when the form has a filter the instant results cannot apply. */
function formParams(form: HTMLFormElement | null): URLSearchParams | null {
  const params = new URLSearchParams()
  if (!form) return params
  const data = new FormData(form)
  if (UNFILTERED_FIELDS.some((name) => String(data.get(name) ?? '') !== '')) return null
  for (const name of ['minSalary', 'remoteMode']) {
    const value = String(data.get(name) ?? '')
    if (value) params.set(name, value)
  }
  return params
}

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
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState('')
  const [results, setResults] = useState<Results | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [formVersion, setFormVersion] = useState(0)
  const lastTyped = useRef('')

  // A change to the salary or work arrangement pills (or a role/location choice) refreshes the results in the
  // background; it never opens the list, which would cover the very controls being used.
  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return
    const onChange = (e: Event) => e.target !== inputRef.current && setFormVersion((v) => v + 1)
    form.addEventListener('change', onChange)
    return () => form.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const q = value.trim()
    const typed = lastTyped.current !== value // false when only the form changed
    lastTyped.current = value
    const params = formParams(inputRef.current?.form ?? null)
    if (q.length < MIN_CHARS || !params) {
      setResults(null)
      setOpen(false)
      return
    }
    params.set('q', q)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/jobs/suggest?${params}`, { signal: controller.signal })
        if (!res.ok) return
        const data = (await res.json()) as { total?: number; jobs?: Job[] }
        const jobs = Array.isArray(data.jobs) ? data.jobs : []
        setResults({ query: q, total: Number(data.total) || jobs.length, jobs })
        setActive(-1)
        if (typed) setOpen(jobs.length > 0)
        else if (jobs.length === 0) setOpen(false)
      } catch {
        // aborted by the next keystroke, or offline: keep whatever the box showed, the search itself still works
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, formVersion])

  const jobs = results?.jobs ?? []
  const rows = jobs.length + 1 // the jobs, then "see all …"

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === 'ArrowDown' && jobs.length > 0) {
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
    } else if (e.key === 'Enter' && active >= 0 && active < jobs.length) {
      e.preventDefault() // a highlighted job opens; with nothing highlighted Enter searches the typed text as usual
      setOpen(false)
      router.push(jobs[active].href)
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
        ref={inputRef}
        id={id}
        name={name}
        type="text"
        placeholder={placeholder}
        className={className}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => jobs.length > 0 && setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
      />
      <span className={styles.srOnly} role="status">
        {open && results ? `${results.total} matching ${results.total === 1 ? 'job' : 'jobs'}, showing ${jobs.length}` : ''}
      </span>
      {open && results ? (
        <ul id={listId} role="listbox" aria-label="Matching jobs" className={styles.list}>
          {jobs.map((job, i) => (
            <li key={job.href} id={`${listId}-${i}`} role="option" aria-selected={i === active} className={styles.option} data-active={i === active}>
              <Link
                href={job.href}
                prefetch={false}
                tabIndex={-1}
                className={styles.link}
                onMouseDown={(e) => e.preventDefault()} // keep focus in the input so blur does not close the list first
                onClick={() => setOpen(false)}
              >
                <span className={styles.label}>{job.title}</span>
                <span className={styles.meta}>
                  {job.company}
                  {job.pay ? ` · ${job.pay}` : ''}
                </span>
              </Link>
            </li>
          ))}
          <li
            id={`${listId}-${jobs.length}`}
            role="option"
            aria-selected={active === jobs.length}
            className={`${styles.option} ${styles.all}`}
            data-active={active === jobs.length}
          >
            {/* No onClick that closes the list: unmounting this button during the click would cancel the submit. The page navigates. */}
            <button type="submit" tabIndex={-1} className={`${styles.link} ${styles.allLink}`} onMouseDown={(e) => e.preventDefault()}>
              <span className={styles.allLabel}>
                See all {results.total.toLocaleString()} {results.total === 1 ? 'job' : 'jobs'} for &ldquo;{results.query}&rdquo;
              </span>
            </button>
          </li>
        </ul>
      ) : null}
    </div>
  )
}
