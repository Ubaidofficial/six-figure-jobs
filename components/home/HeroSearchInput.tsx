'use client'

// components/home/HeroSearchInput.tsx
// The live search box (homepage hero and site header). As you type it shows matching role pages with their job
// counts, then the best matching jobs (logo, title, company, pay) and how many match in all, from the same keyword
// search the form's submit runs, using the salary and work arrangement chosen in the form so the total is what the
// button would show. Focusing the empty box shows the roles with the most jobs. It is still a plain text input named
// `q` inside a GET form: without JavaScript, or if the request fails, the box searches as before. Built as an ARIA
// combobox: arrow keys move (wrapping), Enter opens the highlighted role or job, Escape closes. With `shortcut`, the
// "/" key focuses the box from anywhere on the page. When a role, location or remote region is chosen in the form the
// box shows no instant jobs (they are not filtered by those), and the submit applies everything as usual.

import Link from '@/components/ui/Link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'

import { CompanyLogo } from '@/components/companies/CompanyLogo'

import styles from './HeroSearchInput.module.css'

type Job = { title: string; company: string; pay: string | null; href: string; logo?: string | null }
type Role = { label: string; href: string; count: number }
type Results = { query: string; total: number; jobs: Job[]; roles: Role[] }
type Row = { kind: 'role'; role: Role } | { kind: 'job'; job: Job } | { kind: 'all' }

const MIN_CHARS = 2
const DEBOUNCE_MS = 150
// Example searches typed into the empty box's placeholder one after another (like freehire's search box), so visitors
// see what they can search for. Role names that have their own pages, so each one finds jobs.
const EXAMPLES = [
  'Staff software engineer',
  'Product manager',
  'Data scientist',
  'Machine learning engineer',
  'Engineering manager',
  'DevOps engineer',
  'Account executive',
]
const EXAMPLE_PREFIX = 'Search: '
const TYPE_MS = 70
const DELETE_MS = 35
const HOLD_MS = 1600
const GAP_MS = 400
const START_MS = 1200
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

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  return el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)
}

export function HeroSearchInput({
  id,
  name,
  placeholder,
  className,
  shortcut = false,
  shortcutHint = false,
  typingExamples = false,
  defaultValue = '',
}: {
  id: string
  name: string
  placeholder: string
  className?: string
  /** "/" anywhere on the page focuses this box. Give it to one box per page. */
  shortcut?: boolean
  /** Show a "/" key cap after the input (desktop pointers only). */
  shortcutHint?: boolean
  /** Type example searches into the placeholder while the box is empty and not focused. */
  typingExamples?: boolean
  /** Text the box opens with (the current search on a results page). */
  defaultValue?: string
}) {
  const router = useRouter()
  const listId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultValue)
  const [results, setResults] = useState<Results | null>(null)
  const [popular, setPopular] = useState<Role[] | null>(null)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [formVersion, setFormVersion] = useState(0)
  const [examplePlaceholder, setExamplePlaceholder] = useState<string | null>(null)
  // The query whose suggestions are on their way: the list shows placeholder rows until they arrive.
  const [loadingQuery, setLoadingQuery] = useState<string | null>(null)
  const lastTyped = useRef('')

  // The typing placeholder starts after load (the server HTML has the plain one) and only runs while the box is empty,
  // not focused and the tab is visible; focusing the box shows the plain placeholder. Off under reduced motion.
  useEffect(() => {
    if (!typingExamples || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let word = 0
    let chars = 0
    let deleting = false
    let timer = 0
    const tick = () => {
      const input = inputRef.current
      if (!input || document.activeElement === input || input.value !== '' || document.hidden) {
        chars = 0
        deleting = false
        setExamplePlaceholder(null)
        timer = window.setTimeout(tick, 500)
        return
      }
      const text = EXAMPLES[word]
      chars += deleting ? -1 : 1
      setExamplePlaceholder(EXAMPLE_PREFIX + text.slice(0, chars))
      if (!deleting && chars === text.length) {
        deleting = true
        timer = window.setTimeout(tick, HOLD_MS)
      } else if (deleting && chars === 0) {
        deleting = false
        word = (word + 1) % EXAMPLES.length
        timer = window.setTimeout(tick, GAP_MS)
      } else {
        timer = window.setTimeout(tick, deleting ? DELETE_MS : TYPE_MS)
      }
    }
    timer = window.setTimeout(tick, START_MS)
    return () => window.clearTimeout(timer)
  }, [typingExamples])

  // A change to the salary or work arrangement pills (or a role/location choice) refreshes the results in the
  // background; it never opens the list, which would cover the very controls being used.
  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return
    const onChange = (e: Event) => e.target !== inputRef.current && setFormVersion((v) => v + 1)
    form.addEventListener('change', onChange)
    return () => form.removeEventListener('change', onChange)
  }, [])

  // Leave blank fields (an unchosen role/location/region, "Any" work arrangement, an empty box) out of the address, so the
  // search lands on /jobs?q=data+engineer&minSalary=100000 rather than a URL full of empty parameters. The `formdata`
  // event fires while the browser builds the submission, so this covers Enter, the Search button and "See all".
  // Without JavaScript the form still submits as is, and the results page ignores the empty parameters.
  useEffect(() => {
    const form = inputRef.current?.form
    if (!form) return
    const dropBlanks = (e: FormDataEvent) => {
      for (const [key, val] of Array.from(e.formData.entries())) {
        if (typeof val === 'string' && val.trim() === '') e.formData.delete(key)
        else if (key === name && typeof val === 'string') e.formData.set(key, val.trim())
      }
    }
    form.addEventListener('formdata', dropBlanks)
    return () => form.removeEventListener('formdata', dropBlanks)
  }, [name])

  useEffect(() => {
    if (!shortcut) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey || isTypingTarget(e.target)) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [shortcut])

  useEffect(() => {
    const q = value.trim()
    const typed = lastTyped.current !== value // false when only the form changed
    lastTyped.current = value
    const params = formParams(inputRef.current?.form ?? null)
    if (q.length < MIN_CHARS || !params) {
      setResults(null)
      setLoadingQuery(null)
      if (q.length > 0 || !params) setOpen(false)
      return
    }
    params.set('q', q)
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setLoadingQuery(q)
      if (typed) setOpen(true)
      try {
        const res = await fetch(`/api/jobs/suggest?${params}`, { signal: controller.signal })
        if (!res.ok) {
          setLoadingQuery(null)
          return
        }
        const data = (await res.json()) as { total?: number; jobs?: Job[]; roles?: Role[] }
        const jobs = Array.isArray(data.jobs) ? data.jobs : []
        const roles = Array.isArray(data.roles) ? data.roles : []
        setResults({ query: q, total: Number(data.total) || jobs.length, jobs, roles })
        setLoadingQuery(null)
        setActive(-1)
        const any = jobs.length > 0 || roles.length > 0
        if (typed) setOpen(any)
        else if (!any) setOpen(false)
      } catch (error) {
        // aborted by the next keystroke (whose own request shows the placeholders), or offline: keep whatever the box
        // showed, the search itself still works
        if (!(error instanceof DOMException && error.name === 'AbortError')) setLoadingQuery(null)
      }
    }, DEBOUNCE_MS)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [value, formVersion])

  /** Focusing the empty box shows the biggest roles, fetched once. */
  async function showPopular() {
    if (value.trim() !== '' || !formParams(inputRef.current?.form ?? null)) return
    if (popular) {
      setOpen(popular.length > 0)
      return
    }
    try {
      const res = await fetch('/api/jobs/suggest')
      if (!res.ok) return
      const data = (await res.json()) as { roles?: Role[] }
      const roles = Array.isArray(data.roles) ? data.roles : []
      setPopular(roles)
      if (inputRef.current === document.activeElement && inputRef.current?.value.trim() === '') setOpen(roles.length > 0)
    } catch {
      // nothing to show; typing still searches
    }
  }

  const showingPopular = value.trim() === '' && popular !== null
  const roles = showingPopular ? popular : results?.roles ?? []
  const jobs = showingPopular ? [] : results?.jobs ?? []
  const rows: Row[] = [
    ...roles.map((role) => ({ kind: 'role' as const, role })),
    ...jobs.map((job) => ({ kind: 'job' as const, job })),
    ...(!showingPopular && results && results.total > 0 ? [{ kind: 'all' as const }] : []),
  ]
  // Placeholder rows while a new query's suggestions load (instead of the previous query's, or nothing).
  const skeleton = open && !showingPopular && loadingQuery !== null && results?.query !== loadingQuery
  const listOpen = open && (rows.length > 0 || skeleton)

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!listOpen) {
      if (e.key === 'ArrowDown' && rows.length > 0) {
        e.preventDefault()
        setOpen(true)
        setActive(0)
      }
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (i + 1) % rows.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (i <= 0 ? rows.length - 1 : i - 1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      setActive(-1)
    } else if (e.key === 'Enter' && active >= 0 && rows[active] && rows[active].kind !== 'all') {
      e.preventDefault() // a highlighted role or job opens; otherwise Enter searches the typed text as usual
      const row = rows[active]
      setOpen(false)
      router.push(row.kind === 'role' ? row.role.href : row.kind === 'job' ? row.job.href : '/')
    }
  }

  const optionProps = (i: number) => ({
    id: `${listId}-${i}`,
    role: 'option' as const,
    'aria-selected': i === active,
    'data-active': i === active,
  })
  const linkProps = {
    prefetch: false,
    tabIndex: -1,
    className: styles.link,
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(), // keep focus in the input so blur does not close the list first
    onClick: () => setOpen(false),
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
        enterKeyHint="search"
        placeholder={examplePlaceholder ?? placeholder}
        className={className}
        autoComplete="off"
        spellCheck={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onFocus={() => (value.trim() === '' ? void showPopular() : rows.length > 0 && setOpen(true))}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={listOpen}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={listOpen && active >= 0 ? `${listId}-${active}` : undefined}
        aria-keyshortcuts={shortcut ? '/' : undefined}
      />
      {shortcutHint && value === '' ? (
        <kbd className={styles.kbd} aria-hidden="true">
          /
        </kbd>
      ) : null}
      <span className={styles.srOnly} role="status">
        {listOpen && results && !showingPopular
          ? `${roles.length} matching roles, ${results.total} matching ${results.total === 1 ? 'job' : 'jobs'}`
          : ''}
      </span>
      {listOpen && skeleton ? (
        <ul id={listId} role="listbox" aria-label="Loading suggestions" aria-busy="true" className={styles.list}>
          {[0, 1, 2, 3].map((i) => (
            <li key={i} role="presentation" className={styles.skeletonRow} aria-hidden="true">
              <span className={styles.skeletonLogo} />
              <span className={styles.skeletonText}>
                <span className={styles.skeletonLine} style={{ width: `${70 - i * 10}%` }} />
                <span className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
              </span>
            </li>
          ))}
        </ul>
      ) : listOpen ? (
        <ul id={listId} role="listbox" aria-label={showingPopular ? 'Popular roles' : 'Search suggestions'} className={styles.list}>
          {roles.length > 0 ? (
            <li role="presentation" className={styles.group}>
              {showingPopular ? 'Popular roles' : 'Roles'}
            </li>
          ) : null}
          {roles.map((role, i) => (
            <li key={role.href} {...optionProps(i)} className={styles.option}>
              <Link href={role.href} {...linkProps} className={`${styles.link} ${styles.roleLink}`}>
                <span className={styles.label}>{role.label}</span>
                <span className={styles.count}>{role.count.toLocaleString()}</span>
              </Link>
            </li>
          ))}
          {jobs.length > 0 ? (
            <li role="presentation" className={styles.group}>
              Jobs
            </li>
          ) : null}
          {jobs.map((job, j) => {
            const i = roles.length + j
            return (
              <li key={job.href} {...optionProps(i)} className={styles.option}>
                <Link href={job.href} {...linkProps} className={`${styles.link} ${styles.jobLink}`}>
                  <span className={styles.logo}>
                    <CompanyLogo name={job.company} src={job.logo ?? null} size="fill" />
                  </span>
                  <span className={styles.jobText}>
                    <span className={styles.label}>{job.title}</span>
                    <span className={styles.meta}>
                      {job.company}
                      {job.pay ? ` · ${job.pay}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            )
          })}
          {!showingPopular && results && results.total > 0 ? (
            <li {...optionProps(rows.length - 1)} className={`${styles.option} ${styles.all}`}>
              {/* No onClick that closes the list: unmounting this button during the click would cancel the submit. The page navigates. */}
              <button type="submit" tabIndex={-1} className={`${styles.link} ${styles.allLink}`} onMouseDown={(e) => e.preventDefault()}>
                <span className={styles.allLabel}>
                  See all {results.total.toLocaleString()} {results.total === 1 ? 'job' : 'jobs'} for &ldquo;{results.query}&rdquo;
                </span>
              </button>
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  )
}
