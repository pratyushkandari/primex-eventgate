import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md'
  isLoading?: boolean
}

const VARIANTS: Record<NonNullable<ButtonProps['variant']>, string> = {
  primary: 'bg-accent-strong text-white hover:bg-accent-hover border border-transparent',
  secondary: 'bg-raised text-fg border border-line hover:border-line-strong hover:bg-line/60',
  ghost: 'text-fg-muted hover:text-fg hover:bg-raised border border-transparent',
  danger: 'bg-danger-tint text-danger border border-danger-line hover:bg-danger-line/50',
  success: 'bg-success-strong text-white hover:bg-success-strong-hover border border-transparent',
}

const SIZES: Record<NonNullable<ButtonProps['size']>, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { className, children, variant = 'primary', size = 'md', isLoading = false, disabled, type = 'button', ...props },
    ref
  ) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control)] font-medium whitespace-nowrap',
        'transition-colors duration-150 cursor-pointer select-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {isLoading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  )
)

Button.displayName = 'Button'
