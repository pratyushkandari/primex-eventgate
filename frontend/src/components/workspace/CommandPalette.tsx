import * as React from 'react'
import { Search, X } from 'lucide-react'

export interface CommandItem {
  id: string
  title: string
  description?: string
  category: 'Actions' | 'Scenarios' | 'Editor' | 'Clipboard' | 'Filters' | 'Navigation'
  icon: React.ComponentType<{ className?: string }>
  shortcut?: string
  disabled?: boolean
  onSelect: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  commands: CommandItem[]
}

export function CommandPalette({ isOpen, onClose, commands }: CommandPaletteProps) {
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const listRef = React.useRef<HTMLDivElement>(null)

  const filteredCommands = React.useMemo(() => {
    if (!query.trim()) return commands
    const q = query.toLowerCase()
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
    )
  }, [commands, query])

  // Close on Escape key
  React.useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    if (isOpen) {
      window.addEventListener('keydown', handleGlobalKeyDown)
    }
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [isOpen, onClose])

  // Keyboard navigation inside palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) =>
        prev === 0 ? Math.max(0, filteredCommands.length - 1) : prev - 1
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const selected = filteredCommands[selectedIndex]
      if (selected && !selected.disabled) {
        selected.onSelect()
        onClose()
      }
    }
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/70 backdrop-blur-sm transition-opacity"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
    >
      <div
        className="bg-[#0c121e] border border-slate-700/80 rounded-xl shadow-2xl max-w-xl w-full overflow-hidden flex flex-col font-mono text-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Header */}
        <div className="flex items-center px-3.5 py-3 border-b border-slate-800 bg-[#080c14]">
          <Search className="h-4 w-4 text-slate-400 mr-2.5 flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            placeholder="Type a command or search action..."
            className="bg-transparent text-slate-100 placeholder-slate-500 text-xs w-full focus:outline-none font-mono"
            aria-autocomplete="list"
          />
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300 p-1 rounded hover:bg-slate-800 cursor-pointer"
            aria-label="Close command palette"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Command List */}
        <div
          ref={listRef}
          className="max-h-80 overflow-y-auto p-2 space-y-1 text-xs"
          role="listbox"
        >
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-slate-500 font-sans text-xs">
              No matching commands found.
            </div>
          ) : (
            filteredCommands.map((command, idx) => {
              const Icon = command.icon
              const isSelected = idx === selectedIndex

              return (
                <div
                  key={command.id}
                  role="option"
                  aria-selected={isSelected}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                    command.disabled
                      ? 'opacity-40 cursor-not-allowed'
                      : isSelected
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-500/40'
                      : 'hover:bg-slate-800/60 text-slate-200'
                  }`}
                  onClick={() => {
                    if (!command.disabled) {
                      command.onSelect()
                      onClose()
                    }
                  }}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="flex items-center space-x-2.5 truncate">
                    <Icon className={`h-4 w-4 flex-shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-400'}`} />
                    <div className="truncate">
                      <span className="font-semibold">{command.title}</span>
                      {command.description && (
                        <span className="text-[11px] text-slate-400 ml-2 font-sans">
                          {command.description}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 flex-shrink-0">
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                      {command.category}
                    </span>
                    {command.shortcut && (
                      <kbd className="text-[10px] text-slate-400 bg-slate-900 border border-slate-700/80 px-1.5 py-0.5 rounded">
                        {command.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Footer info strip */}
        <div className="px-3.5 py-2 border-t border-slate-800 bg-[#080c14] text-[10px] text-slate-500 flex items-center justify-between font-mono">
          <div className="flex items-center space-x-3">
            <span>
              <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-slate-400">↑↓</kbd> Navigate
            </span>
            <span>
              <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-slate-400">↵</kbd> Select
            </span>
            <span>
              <kbd className="bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-slate-400">ESC</kbd> Dismiss
            </span>
          </div>
          <span>EventGate Console</span>
        </div>
      </div>
    </div>
  )
}
