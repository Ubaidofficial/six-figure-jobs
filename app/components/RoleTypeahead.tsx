'use client'

import { useMemo, useState, useEffect, useRef } from 'react'
import type { SearchRoleOption } from '../../lib/roles/searchRoles'
import { searchRolesWithSynonyms } from '../../lib/roles/searchRoles'

type Props = {
  options: SearchRoleOption[]
  name?: string
  placeholder?: string
}

export default function RoleTypeahead({
  options,
  name = 'role',
  placeholder = 'e.g., Software Engineer, PM, Data Scientist...',
}: Props) {
  const [query, setQuery] = useState('')
  const [selectedSlug, setSelectedSlug] = useState('')
  const [open, setOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)
  const [matchedSynonym, setMatchedSynonym] = useState<string | null>(null)
  const listRef = useRef<HTMLUListElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  const filtered = useMemo(() => {
    if (!query) {
      // Show popular high-salary roles when empty
      return options
        .filter(opt => [
          'software-engineer',
          'senior-software-engineer',
          'product-manager',
          'data-engineer',
          'data-scientist',
          'devops-engineer',
          'ml-engineer',
          'solutions-architect'
        ].includes(opt.slug))
        .slice(0, 8)
    }

    const results = searchRolesWithSynonyms(query, options)
    
    // Set matched synonym for display
    if (results.length > 0 && results[0].matchedSynonym) {
      setMatchedSynonym(results[0].matchedSynonym)
    } else {
      setMatchedSynonym(null)
    }

    return results.slice(0, 12)
  }, [options, query])

  useEffect(() => {
    setHighlightIndex(0)
  }, [query])

  const commitSelection = (opt: SearchRoleOption) => {
    setQuery(opt.label)
    setSelectedSlug(opt.slug)
    setMatchedSynonym(null)
    setOpen(false)
    inputRef.current?.blur()
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

  // Highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query) return text
    const regex = new RegExp(`(${query})`, 'gi')
    const parts = text.split(regex)
    
    return parts.map((part, i) => 
      regex.test(part) ? (
        <mark key={i} className="bg-cyan-500/20 text-cyan-300 font-semibold">
          {part}
        </mark>
      ) : (
        part
      )
    )
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 transition-all"
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
        aria-label="Find $100k+ job roles"
      />
      <input type="hidden" name={name} value={selectedSlug} />
      
      {/* Synonym hint */}
      {matchedSynonym && query && (
        <div className="absolute left-0 right-0 -bottom-5 text-[10px] text-slate-500">
          Showing results for: <span className="text-cyan-400">{matchedSynonym}</span>
        </div>
      )}

      {open && filtered.length > 0 && (
        <ul
          ref={listRef}
          className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-slate-800 bg-slate-950 shadow-2xl backdrop-blur-xl"
          role="listbox"
        >
          {!query && (
            <li className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
              Popular $100k+ Roles
            </li>
          )}
          {filtered.map((opt, idx) => (
            <li
              key={opt.slug}
              role="option"
              aria-selected={idx === highlightIndex}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors ${
                idx === highlightIndex 
                  ? 'bg-gradient-to-r from-cyan-900/40 to-slate-900 border-l-2 border-cyan-500' 
                  : 'hover:bg-slate-900/80'
              }`}
              onMouseDown={(e) => {
                e.preventDefault()
                commitSelection(opt)
              }}
              onMouseEnter={() => setHighlightIndex(idx)}
            >
              <span className="text-lg">{opt.emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="text-slate-100 truncate">
                  {highlightMatch(opt.label, query)}
                </div>
                {opt.category && (
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {opt.category}
                  </div>
                )}
              </div>
              {opt.salaryRange && (
                <span className="text-[10px] text-cyan-400 font-mono whitespace-nowrap">
                  {opt.salaryRange}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
