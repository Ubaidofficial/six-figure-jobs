'use client'

import * as React from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'

/** Icon button that flips light/dark. Renders a neutral placeholder until mounted so server and client markup match. */
export function ThemeToggle({ className, iconClassName }: { className?: string; iconClassName?: string }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const isDark = !mounted || resolvedTheme !== 'light'
  const next = isDark ? 'light' : 'dark'

  return (
    <button
      type="button"
      className={className}
      aria-label={`Switch to ${next} theme`}
      title={`Switch to ${next} theme`}
      onClick={() => setTheme(next)}
    >
      {isDark ? <Sun className={iconClassName} aria-hidden="true" /> : <Moon className={iconClassName} aria-hidden="true" />}
    </button>
  )
}
