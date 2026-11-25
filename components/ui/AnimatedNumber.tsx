'use client'

// A number that counts up, in a leaf client component. The server renders the final value, so crawlers and visitors
// without JavaScript read the real number, and the page's HTML never changes. Two triggers:
//   - `reveal`: the first time it scrolls into view, but only for a number that starts below the fold, so nothing in the
//     first screen flickers or moves;
//   - a changed `text` (the visitor picked another salary band): it counts from the old value to the new one.
// Under prefers-reduced-motion it never animates. Only the first run of digits in `text` moves ("$150k" counts the
// 150, "1,404,073" keeps its commas); text with a decimal point is left as it is.
// `roll` (owner's request, 2026-11-25: "real time animations to numbers"): for numbers that update live, a changed text
// rolls instead of counting: each digit that changed slides up into place like an odometer, right to left, and a rise
// glows green for a moment. Screen readers get the whole number, not the moving digits.

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

type Slot = { char: string; from: string | null; delay: number }

/**
 * The characters of `to`, each with the character it replaces in `from` when that is a different digit (aligned from the
 * right, so "9,999" -> "10,000" rolls every digit) and a delay that runs right to left (pure).
 */
export function rollSlots(from: string, to: string, stepMs = 45): Slot[] {
  const offset = to.length - from.length
  let changedFromRight = 0
  const slots: Slot[] = new Array(to.length)
  for (let i = to.length - 1; i >= 0; i--) {
    const char = to[i]
    const old = from[i - offset] ?? null
    const rolls = /\d/.test(char) && old !== char
    slots[i] = { char, from: rolls ? (old && /\d/.test(old) ? old : '') : null, delay: rolls ? changedFromRight++ * stepMs : 0 }
  }
  return slots
}

export function AnimatedNumber({ text, className, reveal = false, roll = false }: { text: string; className?: string; reveal?: boolean; roll?: boolean }) {
  const ref = React.useRef<HTMLSpanElement>(null)
  const [shown, setShown] = React.useState(text)
  // A live change being rolled: the old and new text, a key to restart the CSS animation, and whether it went up.
  const [rolling, setRolling] = React.useState<{ from: string; to: string; key: number; up: boolean } | null>(null)
  const rollKey = React.useRef(0)
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
    const previous = lastText.current
    const changed = previous !== null && previous !== text
    lastText.current = text

    if (!target || prefersReducedMotion()) {
      setShown(text)
      current.current = target?.value ?? null
      return
    }
    if (changed && roll) {
      const before = parseNumberText(previous)
      setRolling({ from: previous, to: text, key: ++rollKey.current, up: before ? target.value > before.value : false })
      setShown(text)
      current.current = target.value
      const done = window.setTimeout(() => setRolling(null), 1400)
      return () => window.clearTimeout(done)
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
  }, [text, reveal, roll, animate])

  if (rolling) {
    return (
      <span ref={ref} className={cn(styles.number, styles.roll, rolling.up && styles.up, className)} key={rolling.key}>
        <span className={styles.srOnly}>{rolling.to}</span>
        <span aria-hidden="true">
          {rollSlots(rolling.from, rolling.to).map((s, i) =>
            s.from === null ? (
              <span key={i}>{s.char}</span>
            ) : (
              <span key={i} className={styles.slot} style={{ '--roll-delay': `${s.delay}ms` } as React.CSSProperties}>
                <span className={styles.out}>{s.from}</span>
                <span className={styles.in}>{s.char}</span>
              </span>
            ),
          )}
        </span>
      </span>
    )
  }

  return (
    <span ref={ref} className={cn(styles.number, className)}>
      {shown}
    </span>
  )
}
