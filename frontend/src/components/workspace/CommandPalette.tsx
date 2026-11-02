import * as React from 'react'
import { createPortal } from 'react-dom'
import { Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CommandItem {
  id: string
  title: string
  description?: string
  category: string
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  disabled?: boolean
  keywords?: string[]
  onSelect: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: CommandItem[]
}

function matches(command: CommandItem, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [command.title, command.description, command.category, ...(command.keywords ?? [])].some(
    (text) => text?.toLowerCase().includes(q)
  )
}

/** Ctrl/Cmd+K command list with type-to-filter and arrow-key navigation. */
export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  // Mounting the body on open gives every opening a fresh query and selection.
  return isOpen ? <PaletteBody onClose={onClose} commands={commands} /> : null
}

function PaletteBody({ onClose, commands }: Omit<CommandPaletteProps, 'isOpen'>) {
  const [query, setQuery] = React.useState('')
  const [active, setActive] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listId = React.useId()

  const filtered = React.useMemo(() => commands.filter((c) => matches(c, query)), [commands, query])

  React.useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null
    inputRef.current?.focus()
    return () => previouslyFocused?.focus?.()
  }, [])

  const run = (command: CommandItem | undefined) => {
    if (!command || command.disabled) return
    onClose()
    command.onSelect()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i) => (filtered.length ? (i + 1) % filtered.length : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => (filtered.length ? (i - 1 + filtered.length) % filtered.length : 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      run(filtered[active])
    } else if (e.key === 'Tab') {
      // The search box is the only focusable element; keep focus in the palette.
      e.preventDefault()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-[12vh] animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="w-full max-w-xl overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface shadow-[var(--shadow-overlay)]"
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-line px-3">
          <Search className="h-4 w-4 text-fg-subtle" aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder="Type a command or search"
            aria-label="Search commands"
            role="combobox"
            aria-expanded="true"
            aria-controls={listId}
            aria-activedescendant={filtered[active] ? `${listId}-${filtered[active].id}` : undefined}
            className="h-11 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle focus:outline-none"
          />
          <kbd className="rounded border border-line px-1.5 text-[11px] text-fg-subtle">Esc</kbd>
        </div>
        <ul id={listId} role="listbox" aria-label="Commands" className="max-h-[50vh] overflow-y-auto p-1.5">
          {filtered.length === 0 && <li className="px-3 py-6 text-center text-sm text-fg-subtle">No matching commands</li>}
          {filtered.map((command, index) => {
            const Icon = command.icon
            const showCategory = index === 0 || filtered[index - 1].category !== command.category
            return (
              <React.Fragment key={command.id}>
                {showCategory && (
                  <li role="presentation" className="px-2.5 pt-2 pb-1 text-xs font-medium text-fg-subtle">
                    {command.category}
                  </li>
                )}
                <li
                  id={`${listId}-${command.id}`}
                  role="option"
                  aria-selected={index === active}
                  aria-disabled={command.disabled || undefined}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => run(command)}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-[var(--radius-control)] px-2.5 py-2',
                    index === active ? 'bg-raised' : '',
                    command.disabled && 'cursor-not-allowed opacity-50'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0 text-fg-subtle" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-fg">{command.title}</p>
                    {command.description && <p className="truncate text-xs text-fg-subtle">{command.description}</p>}
                  </div>
                  {command.shortcut && (
                    <kbd className="rounded border border-line px-1.5 text-[11px] text-fg-subtle">{command.shortcut}</kbd>
                  )}
                </li>
              </React.Fragment>
            )
          })}
        </ul>
      </div>
    </div>,
    document.body
  )
}
