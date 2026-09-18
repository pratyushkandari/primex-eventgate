import * as React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'destructive' | 'ghost' | 'success'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      children,
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      type = 'button',
      ...props
    },
    ref
  ) => {
    const baseStyles =
      'inline-flex items-center justify-center font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-blue-500 disabled:opacity-40 disabled:pointer-events-none cursor-pointer select-none'

    const variants = {
      primary: 'bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-sm',
      secondary: 'bg-slate-800/90 hover:bg-slate-800 text-slate-200 border border-slate-700/60',
      outline: 'border border-slate-700/80 hover:bg-slate-800/60 text-slate-300 hover:text-white',
      destructive: 'bg-red-600 hover:bg-red-500 active:bg-red-700 text-white shadow-sm',
      ghost: 'hover:bg-slate-800/60 text-slate-300 hover:text-white',
      success: 'bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-sm',
    }

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2 gap-2',
      lg: 'text-base px-5 py-2.5 gap-2.5',
    }

    return (
      <button
        ref={ref}
        type={type}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        disabled={disabled || isLoading}
        {...props}
      >
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-current" />}
        {children}
      </button>
    )
  }
)

Button.displayName = 'Button'
