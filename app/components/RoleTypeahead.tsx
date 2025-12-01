// app/components/RoleTypeahead.tsx
'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import type { SearchRoleOption } from '../../lib/roles/searchRoles'

type Props = {
  options: SearchRoleOption[]
  name?: string
  placeholder?: string
}

export default function RoleTypeahead({
  options,
  name = 'role',
  placeholder = 'Start typing a role…',
}: Props) {
  const [query, setQuery] = useState('')
  const [selectedSlug, setSelectedSlug] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const listRef = useRef<HTMLUListElement | null>(null)

  const filtered = useMemo(() => {
    if (!query) return options.slice(0, 8)
    const q = query.toLowerCase()
    return options
      .filter((opt) => opt.label.toLowerCase().includes(q))
      .slice(0, 8)
  }, [options, query])

  useEffect(() => {
    setHighlightIndex(0)
  }, [query])

  const commitSelection = (opt: SearchRoleOption) => {
    setQuery(opt.label)
    setSelectedSlug(opt.slug)
    setOpen(false)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      setOpen(true)
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIndex((idx) => Math.min(filtered.length - 1, idx + 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIndex((idx) => Math.max(0, idx - 1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const chosen = filtered[highlightIndex]
      if (chosen) commitSelection(chosen)
      setOpen(false)
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
        placeholder={placeholder}
        value={query}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          setQuery(e.target.value)
          setSelectedSlug('')
          setOpen(true)
        }}
        onKeyDown={onKeyDown}
        aria-autocomplete="list"
        aria-expanded={open}
      />
      <input type="hidden" name={name} value={selectedSlug} />
      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-800 bg-slate-950 shadow-lg"
        >
          {filtered.map((opt, idx) => (
            <li
              key={opt.slug}
              className={`flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-slate-100 hover:bg-slate-900 ${
                idx === highlightIndex ? 'bg-slate-900' : ''
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                commitSelection(opt)
              }}
            >
              <span>{opt.emoji}</span>
              <span>{opt.label}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
