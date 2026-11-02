import * as React from 'react'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button } from '@/components/ui/Button'
import { Badge, StatusBadge } from '@/components/ui/Badge'
import { CopyButton } from '@/components/ui/CopyButton'
import { Dialog } from '@/components/ui/Dialog'
import { ErrorState, EmptyState } from '@/components/ui/States'
import { Segmented } from '@/components/ui/Segmented'
import { ToastProvider } from '@/components/ui/Toast'
import { useToast } from '@/components/ui/toast-context'
import { useHashRoute } from '@/lib/route'

afterEach(() => vi.useRealTimers())

describe('Button', () => {
  it('runs onClick and is a non-submit button by default', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toHaveAttribute('type', 'button')
    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is disabled and busy while loading, which prevents double submits', () => {
    const onClick = vi.fn()
    render(<Button isLoading onClick={onClick}>Save</Button>)
    const button = screen.getByRole('button', { name: 'Save' })
    expect(button).toBeDisabled()
    expect(button).toHaveAttribute('aria-busy', 'true')
    fireEvent.click(button)
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('Badge', () => {
  it.each([
    ['ALLOW', 'text-success'],
    ['REVIEW', 'text-warning'],
    ['BREAK', 'text-danger'],
  ])('StatusBadge %s uses the matching status color', (value, cls) => {
    render(<StatusBadge value={value} />)
    expect(screen.getByText(value)).toHaveClass(cls)
  })

  it('defaults to the neutral tone', () => {
    render(<Badge>staging</Badge>)
    expect(screen.getByText('staging')).toHaveClass('text-fg-muted')
  })
})

describe('Dialog', () => {
  function Harness() {
    const [open, setOpen] = React.useState(false)
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Dialog open={open} onClose={() => setOpen(false)} title="Confirm" footer={<button>Second</button>}>
          <button>First</button>
        </Dialog>
      </>
    )
  }

  it('moves focus in, traps Tab, closes on Escape and restores focus', () => {
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: 'Open' })
    trigger.focus()
    fireEvent.click(trigger)

    const dialog = screen.getByRole('dialog', { name: 'Confirm' })
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()

    screen.getByRole('button', { name: 'Second' }).focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(screen.getByRole('button', { name: 'Close' })).toHaveFocus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(screen.getByRole('button', { name: 'Second' })).toHaveFocus()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(trigger).toHaveFocus()
  })

  it('closes on a backdrop click but not on a click inside', () => {
    render(<Harness />)
    fireEvent.click(screen.getByRole('button', { name: 'Open' }))
    fireEvent.mouseDown(screen.getByRole('button', { name: 'First' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('dialog').parentElement as HTMLElement)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('Toast', () => {
  function Trigger({ type }: { type: 'success' | 'error' }) {
    const toast = useToast()
    return <button onClick={() => toast('Saved', 'All good', type)}>Notify</button>
  }

  it('shows toasts, dismisses them on click and after a timeout', () => {
    vi.useFakeTimers()
    render(
      <ToastProvider>
        <Trigger type="success" />
      </ToastProvider>
    )
    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.getByRole('status')).toHaveTextContent('Saved')
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(screen.queryByText('Saved')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    act(() => vi.advanceTimersByTime(5000))
    expect(screen.queryByText('Saved')).toBeNull()
  })

  it('announces errors assertively and keeps at most three', () => {
    render(
      <ToastProvider>
        <Trigger type="error" />
      </ToastProvider>
    )
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByRole('button', { name: 'Notify' }))
    expect(screen.getAllByRole('alert')).toHaveLength(3)
  })

  it('requires a provider', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Trigger type="success" />)).toThrow(/ToastProvider/)
  })
})

describe('CopyButton', () => {
  it('copies and reports success', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<CopyButton value="evt-1" label="Copy event ID" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy event ID' })))
    expect(writeText).toHaveBeenCalledWith('evt-1')
    expect(screen.getByText('Copied')).toBeInTheDocument()
  })

  it('reports a failed copy instead of failing silently', async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    render(<CopyButton value="x" label="Copy" />)
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Copy' })))
    expect(screen.getByText('Copy failed')).toBeInTheDocument()
  })
})

describe('States and Segmented', () => {
  it('ErrorState shows the error message and retries', () => {
    const onRetry = vi.fn()
    render(<ErrorState title="Could not load" error={new Error('HTTP 500')} hint="Try later" onRetry={onRetry} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Could not load')
    expect(screen.getByText('HTTP 500')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }))
    expect(onRetry).toHaveBeenCalled()
  })

  it('EmptyState renders guidance and an action', () => {
    render(<EmptyState title="Nothing here" action={<button>Add one</button>}>Explain</EmptyState>)
    expect(screen.getByText('Explain')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add one' })).toBeInTheDocument()
  })

  it('Segmented marks the selected option as pressed', () => {
    const onChange = vi.fn()
    render(
      <Segmented
        label="Filter"
        value="a"
        onChange={onChange}
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
      />
    )
    expect(screen.getByRole('button', { name: 'A' })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: 'B' }))
    expect(onChange).toHaveBeenCalledWith('b')
  })
})

describe('useHashRoute', () => {
  it('reads the hash, falls back to review, and navigates', () => {
    window.location.hash = '#/history'
    const { result } = renderHook(() => useHashRoute())
    expect(result.current[0]).toBe('history')

    act(() => result.current[1]('policies'))
    expect(window.location.hash).toBe('#/policies')
    expect(result.current[0]).toBe('policies')

    act(() => {
      window.location.hash = '#/nonsense'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(result.current[0]).toBe('review')
  })
})
