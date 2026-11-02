import { useState } from 'react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Segmented } from '@/components/ui/Segmented'
import type { ChangeSelection } from '@/components/workspace/useReviewSession'
import { ConsumerExplorerView } from './ConsumerExplorerView'
import { ContractRegistryView } from './ContractRegistryView'

interface ContractsHubProps {
  onOpenReview: (change: ChangeSelection) => void
}

/** Contracts page: event contract versions and the consumer contracts that read them. */
export function ContractsHub({ onOpenReview }: ContractsHubProps) {
  const [view, setView] = useState<'events' | 'consumers'>('events')
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null)

  return (
    <div>
      <PageHeader
        title="Contracts"
        description="Versioned event schemas and the fields each consumer depends on."
        actions={
          <Segmented
            label="Contract type"
            value={view}
            onChange={setView}
            options={[
              { value: 'events', label: 'Event contracts' },
              { value: 'consumers', label: 'Consumer contracts' },
            ]}
          />
        }
      />
      {view === 'events' ? (
        <ContractRegistryView
          selectedEventType={selectedEvent}
          onSelectEventType={setSelectedEvent}
          onOpenReview={onOpenReview}
        />
      ) : (
        <ConsumerExplorerView
          onSelectEvent={(eventType) => {
            setSelectedEvent(eventType)
            setView('events')
          }}
        />
      )}
    </div>
  )
}
