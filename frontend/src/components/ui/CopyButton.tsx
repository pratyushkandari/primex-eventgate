import * as React from 'react'
import { Check, Copy } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CopyButtonProps {
  value: string
  /** Accessible name, e.g. "Copy event ID". */
  label: string
  showText?: boolean
  className?: string
}

/** Copies `value` to the clipboard and shows a check mark (or an error) for two seconds. */
export function CopyButton({ value, label, showText = false, className }: CopyButtonProps) {
  const [state, setState] = React.useState<'idle' | 'copied' | 'failed'>('idle')

  React.useEffect(() => {
    if (state === 'idle') return
    const timer = setTimeout(() => setState('idle'), 2000)
    return () => clearTimeout(timer)
  }, [state])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setState('copied')
    } catch {
      setState('failed')
    }
  }

  const text = state === 'copied' ? 'Copied' : state === 'failed' ? 'Copy failed' : 'Copy'
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={showText ? undefined : label}
      title={label}
      className={cn(
        'inline-flex items-center gap-1 rounded px-1 py-0.5 text-xs text-fg-subtle transition-colors hover:bg-raised hover:text-fg',
        state === 'failed' && 'text-danger',
        className
      )}
    >
      {state === 'copied' ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {showText && (
        <span>
          {text}
          <span className="sr-only"> ({label})</span>
        </span>
      )}
      <span className="sr-only" role="status">
        {state === 'idle' ? '' : text}
      </span>
    </button>
  )
}
