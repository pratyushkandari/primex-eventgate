import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { SchemaDiff } from '@/components/workspace/SchemaDiff'
import type { ChangeSet } from '@/types/api'

describe('SchemaDiff component', () => {
  it('renders empty state when there are no changes', () => {
    const emptyChangeSet: ChangeSet = {
      addedFields: [],
      removedFields: [],
      typeChanges: [],
      requirednessChanges: [],
    }

    render(<SchemaDiff changeSet={emptyChangeSet} />)

    expect(screen.getByText('Schema Diff')).toBeInTheDocument()
    expect(screen.getByText('No schema changes detected between versions.')).toBeInTheDocument()
  })

  it('renders additions, removals, type changes, and requiredness updates', () => {
    const changeSet: ChangeSet = {
      addedFields: ['loyaltyTier'],
      removedFields: ['discountCode'],
      typeChanges: [{ field: 'totalAmount', fromType: 'number', toType: 'string' }],
      requirednessChanges: [{ field: 'customerEmail', fromRequired: false, toRequired: true }],
    }

    render(<SchemaDiff changeSet={changeSet} />)

    expect(screen.getByText('+1 added')).toBeInTheDocument()
    expect(screen.getByText('-1 removed')).toBeInTheDocument()
    expect(screen.getByText('1 type change')).toBeInTheDocument()
    expect(screen.getByText('1 requiredness')).toBeInTheDocument()

    expect(screen.getByText('loyaltyTier')).toBeInTheDocument()
    expect(screen.getByText('discountCode')).toBeInTheDocument()
    expect(screen.getByText('totalAmount')).toBeInTheDocument()
    expect(screen.getByText('customerEmail')).toBeInTheDocument()

    expect(screen.getByText(/number/i)).toBeInTheDocument()
    expect(screen.getByText(/string/i)).toBeInTheDocument()
  })

  it('calls onSelectField when clicking a field diff row', () => {
    const changeSet: ChangeSet = {
      addedFields: ['loyaltyTier'],
      removedFields: [],
      typeChanges: [],
      requirednessChanges: [],
    }
    const handleSelectField = vi.fn()

    render(
      <SchemaDiff
        changeSet={changeSet}
        selectedField={null}
        onSelectField={handleSelectField}
      />
    )

    const fieldBtn = screen.getByRole('button', { name: /loyaltyTier/i })
    fireEvent.click(fieldBtn)

    expect(handleSelectField).toHaveBeenCalledWith('loyaltyTier')
  })

  it('toggles field selection off when clicking already selected field', () => {
    const changeSet: ChangeSet = {
      addedFields: ['loyaltyTier'],
      removedFields: [],
      typeChanges: [],
      requirednessChanges: [],
    }
    const handleSelectField = vi.fn()

    render(
      <SchemaDiff
        changeSet={changeSet}
        selectedField="loyaltyTier"
        onSelectField={handleSelectField}
      />
    )

    const fieldBtn = screen.getByRole('button', { name: /loyaltyTier/i })
    fireEvent.click(fieldBtn)

    expect(handleSelectField).toHaveBeenCalledWith(null)
  })
})
