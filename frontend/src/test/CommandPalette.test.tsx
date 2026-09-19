import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { CommandPalette, type CommandItem } from '@/components/workspace/CommandPalette'
import { Play, Sparkles } from 'lucide-react'

describe('CommandPalette component', () => {
  const mockCommands: CommandItem[] = [
    {
      id: 'cmd-analyze',
      title: 'Analyze Compatibility',
      description: 'Run pre-flight check',
      category: 'Actions',
      icon: Play,
      shortcut: '⌘↵',
      onSelect: vi.fn(),
    },
    {
      id: 'cmd-safe',
      title: 'Scenario: Safe Addition',
      description: 'Optional field added',
      category: 'Scenarios',
      icon: Sparkles,
      onSelect: vi.fn(),
    },
  ]

  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <CommandPalette isOpen={false} onClose={vi.fn()} commands={mockCommands} />
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders command palette and items when isOpen is true', () => {
    render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={mockCommands} />)

    expect(screen.getByRole('dialog', { name: /Command Palette/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/Type a command/i)).toBeInTheDocument()
    expect(screen.getByText('Analyze Compatibility')).toBeInTheDocument()
    expect(screen.getByText('Scenario: Safe Addition')).toBeInTheDocument()
  })

  it('filters commands by user query', () => {
    render(<CommandPalette isOpen={true} onClose={vi.fn()} commands={mockCommands} />)

    const input = screen.getByPlaceholderText(/Type a command/i)
    fireEvent.change(input, { target: { value: 'Safe' } })

    expect(screen.getByText('Scenario: Safe Addition')).toBeInTheDocument()
    expect(screen.queryByText('Analyze Compatibility')).not.toBeInTheDocument()
  })

  it('executes command on click and calls onClose', () => {
    const handleClose = vi.fn()
    render(<CommandPalette isOpen={true} onClose={handleClose} commands={mockCommands} />)

    const commandRow = screen.getByText('Analyze Compatibility')
    fireEvent.click(commandRow)

    expect(mockCommands[0].onSelect).toHaveBeenCalledTimes(1)
    expect(handleClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn()
    render(<CommandPalette isOpen={true} onClose={handleClose} commands={mockCommands} />)

    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Escape' })

    expect(handleClose).toHaveBeenCalledTimes(1)
  })
})
