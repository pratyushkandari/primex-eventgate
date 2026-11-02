import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SchemaDiff } from '@/components/workspace/SchemaDiff'
import { FindingsPanel } from '@/components/workspace/FindingsPanel'
import { analysis } from './fixtures'

const changeSet = {
  addedFields: ['metadata'],
  removedFields: ['couponCode'],
  typeChanges: [{ field: 'shippingMethod', fromType: 'string', toType: 'object' }],
  requirednessChanges: [{ field: 'amount', fromRequired: true, toRequired: false }],
}

describe('SchemaDiff', () => {
  it('says so when there are no changes', () => {
    render(<SchemaDiff changeSet={{ addedFields: [], removedFields: [], typeChanges: [], requirednessChanges: [] }} />)
    expect(screen.getByText('No schema changes')).toBeInTheDocument()
  })

  it('lists every kind of change with its detail', () => {
    render(<SchemaDiff changeSet={changeSet} />)
    expect(screen.getByRole('button', { name: /metadata added/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /couponCode removed/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /shippingMethod string → object/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /amount required → optional/ })).toBeInTheDocument()
  })

  it('shows which consumers a changed field affects', () => {
    const a = analysis('BLOCK')
    render(<SchemaDiff changeSet={a.changeSet} findings={a.findings} />)
    expect(screen.getByText('affects inventory-service')).toBeInTheDocument()
  })

  it('toggles field selection', () => {
    const onSelect = vi.fn()
    const { rerender } = render(<SchemaDiff changeSet={changeSet} onSelectField={onSelect} />)
    fireEvent.click(screen.getByRole('button', { name: /metadata/ }))
    expect(onSelect).toHaveBeenLastCalledWith('metadata')
    rerender(<SchemaDiff changeSet={changeSet} onSelectField={onSelect} selectedField="metadata" />)
    expect(screen.getByRole('button', { name: /metadata/ })).toHaveAttribute('aria-pressed', 'true')
    fireEvent.click(screen.getByRole('button', { name: /metadata/ }))
    expect(onSelect).toHaveBeenLastCalledWith(null)
  })
})

describe('FindingsPanel', () => {
  it('renders nothing without an analysis', () => {
    const { container } = render(<FindingsPanel analysis={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the diff and every finding with its rule', () => {
    const onSelectConsumer = vi.fn()
    render(<FindingsPanel analysis={analysis('BLOCK')} onSelectConsumer={onSelectConsumer} />)
    expect(screen.getByText('3 findings across 3 consumers')).toBeInTheDocument()
    expect(screen.getByText('EVT001_FIELD_TYPE_CHANGED')).toBeInTheDocument()
    expect(screen.getByText(/expects 'shippingMethod' to be string/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'inventory-service' }))
    expect(onSelectConsumer).toHaveBeenCalledWith('inventory-service')
  })
})
