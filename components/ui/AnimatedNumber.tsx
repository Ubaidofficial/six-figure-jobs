'use client'

// A number that counts up, in a leaf client component. The server renders the final value, so crawlers and visitors
// without JavaScript read the real number, and the page's HTML never changes. Two triggers:
//   - `reveal`: the first time it scrolls into view, but only for a number that starts below the fold, so nothing in the
//     first screen flickers or moves;
//   - a changed `text` (the visitor picked another salary band): it counts from the old value to the new one.
// Under prefers-reduced-motion it never animates. Only the first run of digits in `text` moves ("$150k" counts the
// 150, "1,404,073" keeps its commas); text with a decimal point is left as it is.

import * as React from 'react'

import { cn } from '@/lib/utils'

import styles from './AnimatedNumber.module.css'

const DURATION_MS = 900
const FIRST_NUMBER = /\d[\d,]*/

type Parts = { pre: string; post: string; value: number; grouped: boolean }

export function parseNumberText(text: string): Parts | null {
  const match = FIRST_NUMBER.exec(text)
  if (!match) return null
  const end = match.index + match[0].length
  if (text[end] === '.' && /\d/.test(text[end + 1] ?? '')) return null
  return {
    pre: text.slice(0, match.index),
    post: text.slice(end),
    value: Number(match[0].replace(/,/g, '')),
    grouped: match[0].includes(','),
  }
}

export function formatNumberText(parts: Pick<Parts, 'pre' | 'post' | 'grouped'>, n: number): string {
  const rounded = Math.round(n)
  return parts.pre + (parts.grouped ? rounded.toLocaleString('en-US') : String(rounded)) + parts.post
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function AnimatedNumber({ text, className, reveal = false }: { text: string; className?: string; reveal?: boolean }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [shown, setShown] = React.useState(text)
  const raf = React.useRef(0)
  const current = React.useRef<number | null>(parseNumberText(text)?.value ?? null)
  const lastText = React.useRef<string | null>(null)

  const animate = React.useCallback((from: number, to: string) => {
    cancelAnimationFrame(raf.current)
    const parts = parseNumberText(to)
    if (!parts) {
      setShown(to)
      return
    }
    const startedAt = performance.now()
    const step = (now: number) => {
      const t = Math.min(1, (now - startedAt) / DURATION_MS)
      const n = from + (parts.value - from) * (1 - Math.pow(1 - t, 3))
      current.current = n
      setShown(t >= 1 ? to : formatNumberText(parts, n))
      if (t < 1) raf.current = requestAnimationFrame(step)
    }
    raf.current = requestAnimationFrame(step)
  }, [])

  React.useEffect(() => {
    const target = parseNumberText(text)
    const changed = lastText.current !== null && lastText.current !== text
    lastText.current = text

    if (!target || prefersReducedMotion()) {
      setShown(text)
      current.current = target?.value ?? null
      return
    }
    if (changed) {
      animate(current.current ?? target.value, text)
      return () => cancelAnimationFrame(raf.current)
    }

    // First render of this text: count up on first sight, and only a number that is still below the fold.
    const el = ref.current
    if (!reveal || !el || typeof IntersectionObserver === 'undefined') return
    if (el.getBoundingClientRect().top < window.innerHeight) return
    setShown(formatNumberText(target, 0))
    current.current = 0
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        observer.disconnect()
        animate(0, text)
      },
      { threshold: 0.4 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(raf.current)
    }
  }, [text, reveal, animate])

  return (
    <span ref={ref} className={cn(styles.number, className)}>
      {shown}
    </span>
  )
}
