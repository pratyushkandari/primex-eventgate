/**
 * ConsumerExplorerView — Downstream consumer contract explorer.
 * Shows which downstream services depend on which events, expected fields, and types.
 */

import { useState } from 'react'
import {
  Users,
  Search,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
  FileCode2,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { useConsumers, useConsumerDetail } from '@/services/queries'

interface ConsumerExplorerViewProps {
  onSelectEvent?: (eventType: string) => void
}

export function ConsumerExplorerView({ onSelectEvent }: ConsumerExplorerViewProps) {
  const { data: consumers, isLoading, error } = useConsumers()
  const [selectedConsumerId, setSelectedConsumerId] = useState<string>('inventory-service')
  const [searchQuery, setSearchQuery] = useState('')

  const { data: consumerDetail, isLoading: isLoadingDetail } = useConsumerDetail(selectedConsumerId)

  const filteredConsumers = (consumers || []).filter((c) =>
    c.consumerId.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.eventType.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Top Header & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-zinc-900/60 border border-zinc-800">
        <div>
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-400" />
            Downstream Consumer Contract Explorer
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Inspect downstream consumer dependencies, expected field schemas, and type expectations.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="Search consumers or events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-950 border border-zinc-700/80 rounded-md text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-indigo-500/60 transition-colors"
          />
        </div>
      </div>

      {isLoading && (
        <div className="p-12 text-center text-xs text-zinc-500 animate-pulse">
          Loading consumer contracts from server...
        </div>
      )}

      {error && (
        <div className="p-4 rounded-md bg-rose-950/30 border border-rose-800/60 text-xs text-rose-300">
          Failed to load consumers: {error.message}
        </div>
      )}

      {!isLoading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Consumers List (4 cols) */}
          <div className="lg:col-span-4 space-y-2">
            <div className="text-xs font-medium uppercase tracking-wider text-zinc-400 px-1">
              Registered Consumers ({filteredConsumers.length})
            </div>

            <div className="space-y-2">
              {filteredConsumers.map((c) => {
                const isSelected = c.consumerId === selectedConsumerId
                return (
                  <button
                    key={c.consumerId}
                    onClick={() => setSelectedConsumerId(c.consumerId)}
                    className={`w-full text-left p-3.5 rounded-lg border transition-all ${
                      isSelected
                        ? 'bg-zinc-800/90 border-indigo-500/60 shadow-sm shadow-indigo-950/20'
                        : 'bg-zinc-900/40 border-zinc-800 hover:bg-zinc-800/50 hover:border-zinc-700/80'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-mono font-semibold text-zinc-200 flex items-center gap-1.5">
                        {c.consumerId}
                        {isSelected && <ChevronRight className="w-4 h-4 text-indigo-400" />}
                      </span>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs text-zinc-400">
                      <span className="text-zinc-400">
                        Subscribes to <span className="font-semibold text-zinc-300">{c.eventType}</span>
                      </span>
                      <span className="text-[11px] font-mono text-zinc-500">
                        {c.expectedFieldsCount} fields
                      </span>
                    </div>
                  </button>
                )
              })}

              {filteredConsumers.length === 0 && (
                <div className="p-6 text-center text-xs text-zinc-500 border border-dashed border-zinc-800 rounded-lg">
                  No consumers match "{searchQuery}"
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Consumer Contract Detail (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            {isLoadingDetail ? (
              <div className="p-12 text-center text-xs text-zinc-500">
                Loading consumer contract specifications...
              </div>
            ) : consumerDetail ? (
              <div className="p-5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-5">
                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-zinc-800 gap-3">
                  <div>
                    <div className="flex items-center gap-2.5">
                      <h3 className="text-base font-mono font-bold text-zinc-100">
                        {consumerDetail.consumerId}
                      </h3>
                      <Badge variant="neutral" size="sm">
                        Downstream Subscriber
                      </Badge>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1">
                      Subscribed to event contract <span className="font-semibold text-zinc-200">{consumerDetail.eventType}</span>
                    </p>
                  </div>

                  {onSelectEvent && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => onSelectEvent(consumerDetail.eventType)}
                      className="text-xs"
                    >
                      <FileCode2 className="w-3.5 h-3.5 mr-1.5 text-zinc-400" />
                      View {consumerDetail.eventType} Contract
                    </Button>
                  )}
                </div>

                {/* Expected Fields Table */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                      Expected Field Contracts ({Object.keys(consumerDetail.expectedFields).length})
                    </span>
                    <span className="text-[11px] text-zinc-500">
                      Downstream schema guarantees
                    </span>
                  </div>

                  <div className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/60">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-zinc-800/80 bg-zinc-900/50 text-zinc-400 font-medium">
                          <th className="py-2 px-3">Expected Field</th>
                          <th className="py-2 px-3">Required Type</th>
                          <th className="py-2 px-3">Consumer Constraint</th>
                          <th className="py-2 px-3 text-right">Failure Impact</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-800/50">
                        {Object.entries(consumerDetail.expectedFields).map(([fieldName, fieldSpec]) => (
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
                                  Strictly Required
                                </span>
                              ) : (
                                <span className="inline-flex items-center text-[11px] text-zinc-500">
                                  Optional Field
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {fieldSpec.required ? (
                                <span className="inline-flex items-center text-[11px] text-rose-400 font-medium">
                                  <AlertCircle className="w-3 h-3 mr-1" />
                                  Breaking if removed/changed
                                </span>
                              ) : (
                                <span className="text-[11px] text-zinc-500">
                                  Tolerates removal
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Consumer Scope Note */}
                <div className="p-3 rounded-md bg-zinc-950/80 border border-zinc-800 text-xs text-zinc-400 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-zinc-200">Consumer Scoping:</span> EventGate checks
                    proposals against this specific schema contract. Fields added to {consumerDetail.eventType} that
                    are not consumed by {consumerDetail.consumerId} are safe and will not break this service.
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
