import * as React from 'react'

import { cn } from '@/lib/utils'

import styles from './button.module.css'

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'disabled'> {
  variant?: ButtonVariant
  size?: ButtonSize
  children: React.ReactNode
  icon?: React.ReactNode
  disabled?: boolean
  loading?: boolean
  className?: string
}

function getIconPosition(props: Record<string, unknown>): 'left' | 'right' {
  const raw = props['data-icon-position']
  if (raw === 'right' || raw === 'end' || raw === 'after') return 'right'
  return 'left'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      children,
      icon,
      disabled = false,
      loading = false,
      className,
      type,
      ...rest
    },
    ref
  ) => {
    const isDisabled = disabled || loading
    const iconPosition = getIconPosition(rest as Record<string, unknown>)

    return (
      <button
        ref={ref}
        type={type ?? 'button'}
        disabled={isDisabled}
        aria-disabled={isDisabled || undefined}
        aria-busy={loading || undefined}
        className={cn(
          styles.button,
          styles[variant],
          styles[size],
          loading && styles.loading,
          iconPosition === 'right' && styles.iconRight,
          className
        )}
        {...rest}
      >
        {loading && (
          <>
            <span className={styles.spinner} aria-hidden="true" />
            <span className={styles.srOnly}>Loading</span>
          </>
        )}

        {!loading && icon && <span className={styles.icon}>{icon}</span>}
        <span className={styles.content}>{children}</span>
      </button>
    )
  }
)

Button.displayName = 'Button'

export { Button }
