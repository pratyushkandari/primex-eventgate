/**
 * ContractRegistryView — Event Catalog and Version Schema Inspector.
 * Uses real contract data from /api/v1/contracts/events.
 */

import { useState } from 'react'
import {
  Search,
  Layers,
  Users,
  ExternalLink,
  ChevronRight,
  Database,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useEventCatalog, useEventDetail } from '@/services/queries'

interface ContractRegistryViewProps {
  onOpenReviewScenario?: (eventType: string, currentVer: number, proposedVer: number) => void
}

export function ContractRegistryView({ onOpenReviewScenario }: ContractRegistryViewProps) {
  const { data: catalog, isLoading, error, refetch } = useEventCatalog()
  const [selectedEventType, setSelectedEventType] = useState<string>('OrderPlaced')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVersionNum, setSelectedVersionNum] = useState<number | null>(null)

  const { data: eventDetail, isLoading: isLoadingDetail } = useEventDetail(selectedEventType)

  const filteredCatalog = (catalog || []).filter((item) =>
    item.eventType.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Determine active contract version
  const activeVersion =
    eventDetail?.contracts.find((c) =>
      selectedVersionNum !== null ? c.version === selectedVersionNum : c.version === eventDetail.latestVersion
    ) || eventDetail?.contracts[0]

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Database className="w-5 h-5 text-emerald-400" />
            Event Contracts
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Authoritative event schema definitions and versioned contract registry.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Filter event types..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700/80 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
        </div>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-xs text-zinc-500 animate-pulse">
          Loading event contracts from server...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-rose-950/30 border border-rose-800/60 text-xs text-rose-300 flex items-center justify-between">
          <div>
            <span className="font-semibold block">Unable to load event contracts.</span>
            <span className="text-[11px] text-rose-300/80">Check the release API connection and retry.</span>
          </div>
          <button
            type="button"
            onClick={() => refetch()}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs transition-colors cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && filteredCatalog.length === 0 && (
        <div className="p-12 text-center text-xs text-zinc-500 rounded-lg border border-dashed border-zinc-800 bg-zinc-900/20">
          <Database className="mx-auto h-8 w-8 text-zinc-600 mb-2" />
          <span className="font-medium text-zinc-300 block">
            {searchQuery ? 'No event contracts match the current search query.' : 'No event contracts registered yet.'}
          </span>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="mt-2 text-emerald-400 hover:underline cursor-pointer"
            >
              Clear search filter
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Event List (4 cols) */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-400 px-1">
              Registered Event Types ({filteredCatalog.length})
            </div>

            <div className="space-y-2">
              {filteredCatalog.map((event) => {
                const isSelected = event.eventType === selectedEventType
                return (
                  <button
                    key={event.eventType}
                    onClick={() => {
                      setSelectedEventType(event.eventType)
                      setSelectedVersionNum(null)
                    }}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-zinc-800/90 border-emerald-500/60 shadow-sm shadow-emerald-950/20'
                        : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-zinc-200 flex items-center gap-2">
                        {event.eventType}
                        {isSelected && <ChevronRight className="w-4 h-4 text-emerald-400" />}
                      </span>
                      <Badge variant="neutral" size="sm">
                        v{event.latestVersion} latest
                      </Badge>
                    </div>

                    <div className="mt-2.5 flex items-center gap-4 text-xs text-zinc-400">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-zinc-500" />
                        {event.versionCount} versions
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-zinc-500" />
                        {event.consumerCount} consumers
                      </span>
                    </div>
                  </button>
                )
              })}

              {filteredCatalog.length === 0 && (
                <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                  No event types match "{searchQuery}"
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Event Detail & Version Inspector (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {isLoadingDetail ? (
              <div className="p-12 text-center text-xs text-zinc-500">
                Loading contract specification...
              </div>
            ) : eventDetail ? (
              <div className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-5">
                {/* Event Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-bold text-zinc-100">{eventDetail.eventType}</h3>
                      <Badge variant="safe" size="sm">
                        Active Contract
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      {eventDetail.versionCount} registered versions • {eventDetail.consumers.length} subscribing downstream services
                    </p>
                  </div>

                  {onOpenReviewScenario && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onOpenReviewScenario(eventDetail.eventType, 1, eventDetail.latestVersion)}
                      className="text-xs"
                    >
                      <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                      Review in Workspace
                    </Button>
                  )}
                </div>

                {/* Version Selector Tabs */}
                <div>
                  <div className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    Select Contract Version to Inspect
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {eventDetail.versions.map((ver) => {
                      const isActive =
                        activeVersion?.version === ver ||
                        (selectedVersionNum === null && ver === eventDetail.latestVersion)
                      return (
                        <button
                          key={ver}
                          onClick={() => setSelectedVersionNum(ver)}
                          className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium border transition-all ${
                            isActive
                              ? 'bg-emerald-950/60 border-emerald-500/70 text-emerald-300'
                              : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                          }`}
                        >
                          v{ver} {ver === eventDetail.latestVersion ? '(latest)' : ''}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Schema Fields Table */}
                {activeVersion && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Schema Fields — v{activeVersion.version}
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {Object.keys(activeVersion.fields).length} fields defined
                      </span>
                    </div>

                    <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/60">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-zinc-400 font-medium">
                            <th className="py-2 px-3">Field Name</th>
                            <th className="py-2 px-3">Data Type</th>
                            <th className="py-2 px-3">Requiredness</th>
                            <th className="py-2 px-3 text-right">Consumer Usage</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/50">
                          {Object.entries(activeVersion.fields).map(([fieldName, fieldSpec]) => {
                            // Calculate how many consumers expect this field
                            const consumersRequiring = eventDetail.consumers.filter(
                              (c) => fieldName in c.expectedFields
                            )
                            return (
                              <tr key={fieldName} className="hover:bg-zinc-900/40">
                                <td className="py-2.5 px-3 font-mono font-medium text-zinc-200">
                                  {fieldName}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-zinc-400">
                                  <span className="px-1.5 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                                    {fieldSpec.type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  {fieldSpec.required ? (
                                    <span className="inline-flex items-center text-[11px] text-amber-400 font-medium">
                                      Required
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center text-[11px] text-zinc-500">
                                      Optional
                                    </span>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-right text-zinc-400 font-mono text-[11px]">
                                  {consumersRequiring.length > 0 ? (
                                    <span className="text-emerald-400/90 font-medium">
                                      {consumersRequiring.length} {consumersRequiring.length === 1 ? 'consumer' : 'consumers'}
                                    </span>
                                  ) : (
                                    <span className="text-zinc-600">unused</span>
                                  )}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Subscribed Consumers for this contract */}
                <div className="space-y-2.5 pt-2 border-t border-zinc-800">
                  <div className="text-xs font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <Users className="w-3.5 h-3.5 text-zinc-400" />
                    Subscribing Downstream Consumers ({eventDetail.consumers.length})
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {eventDetail.consumers.map((c) => (
                      <div
                        key={c.consumerId}
                        className="p-3 rounded-md bg-zinc-950 border border-zinc-800/80 space-y-1"
                      >
                        <div className="font-mono text-xs font-semibold text-zinc-200">
                          {c.consumerId}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          Requires {Object.keys(c.expectedFields).length} fields
                        </div>
                      </div>
                    ))}

                    {eventDetail.consumers.length === 0 && (
                      <div className="col-span-3 p-4 text-center text-xs text-zinc-500">
                        No downstream consumers registered for this event.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  )
}
