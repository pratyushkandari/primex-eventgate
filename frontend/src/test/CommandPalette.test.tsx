import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Play, Settings } from 'lucide-react'
import { CommandPalette, type CommandItem } from '@/components/workspace/CommandPalette'

function commands(overrides: Partial<Record<string, Partial<CommandItem>>> = {}): CommandItem[] {
  return [
    { id: 'analyze', title: 'Analyze compatibility', category: 'Actions', icon: Play, onSelect: vi.fn(), ...overrides.analyze },
    { id: 'publish', title: 'Publish event', category: 'Actions', icon: Play, disabled: true, onSelect: vi.fn(), ...overrides.publish },
    { id: 'settings', title: 'Go to Settings', category: 'Navigation', icon: Settings, keywords: ['config'], onSelect: vi.fn(), ...overrides.settings },
  ]
}

describe('CommandPalette', () => {
  it('renders nothing when closed', () => {
    render(<CommandPalette isOpen={false} onClose={vi.fn()} commands={commands()} />)
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('focuses the search box and groups commands by category', () => {
    render(<CommandPalette isOpen onClose={vi.fn()} commands={commands()} />)
    expect(screen.getByRole('combobox', { name: 'Search commands' })).toHaveFocus()
    expect(screen.getByText('Actions')).toBeInTheDocument()
    expect(screen.getByText('Navigation')).toBeInTheDocument()
  })

  it('filters by title and keyword', () => {
    render(<CommandPalette isOpen onClose={vi.fn()} commands={commands()} />)
    const input = screen.getByRole('combobox')
    fireEvent.change(input, { target: { value: 'config' } })
    expect(screen.getAllByRole('option')).toHaveLength(1)
    fireEvent.change(input, { target: { value: 'zzz' } })
    expect(screen.getByText('No matching commands')).toBeInTheDocument()
  })

  it('runs commands with the keyboard and skips disabled ones', () => {
    const items = commands()
    const onClose = vi.fn()
    render(<CommandPalette isOpen onClose={onClose} commands={items} />)
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    expect(screen.getAllByRole('option')[1]).toHaveAttribute('aria-selected', 'true')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(items[1].onSelect).not.toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'ArrowDown' })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(items[2].onSelect).toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('wraps upward, runs on click and closes on Escape', () => {
    const items = commands()
    const onClose = vi.fn()
    render(<CommandPalette isOpen onClose={onClose} commands={items} />)
    const input = screen.getByRole('combobox')
    fireEvent.keyDown(input, { key: 'ArrowUp' })
    expect(screen.getAllByRole('option')[2]).toHaveAttribute('aria-selected', 'true')
    fireEvent.click(screen.getByText('Analyze compatibility'))
    expect(items[0].onSelect).toHaveBeenCalled()
    fireEvent.keyDown(input, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(2)
  })
})
