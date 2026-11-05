// components/layout/Wordmark.tsx
// The logo: "six [fig] jobs" in Outfit ExtraBold with "fig" on a lime tile (the tile idea is borrowed from
// 4dayweek.io's logo, where a colour tile carries the "4"). Live text, so it needs no image request and scales
// crisply. The outlined SVG version for sharing is public/logo.svg; the square icon is app/icon.svg.

import styles from './Wordmark.module.css'

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={`${styles.wordmark} ${className ?? ''}`}>
      <span>six</span>
      <span className={styles.tile}>fig</span>
      <span>jobs</span>
    </span>
  )
}
