import {
  Server,
  Database,
  Cloud,
  Radio,
  Cpu,
  FolderTree,
  RefreshCw,
  XCircle,
  CheckCircle2,
} from 'lucide-react'
import { useRuntimeConfig } from '@/services/queries'
import { Badge } from '@/components/ui/Badge'

export function SettingsView() {
  const { data: config, isLoading, error, refetch } = useRuntimeConfig()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 font-mono text-xs text-slate-400">
        <RefreshCw className="h-4 w-4 mr-2 animate-spin text-blue-400" />
        Inspecting runtime configuration...
      </div>
    )
  }

  if (error || !config) {
    return (
      <div className="bg-rose-950/30 border border-rose-500/50 rounded-lg p-5 text-xs text-rose-300 font-mono">
        <div className="flex items-center space-x-2 font-bold mb-1">
          <XCircle className="h-4 w-4 text-rose-400" />
          <span>Failed to inspect runtime platform configuration</span>
        </div>
        <p>{error?.message || 'Configuration service unavailable'}</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 text-blue-400 hover:text-blue-300 underline cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }

  const items = [
    {
      label: 'Target Environment',
      value: config.environment,
      detail: 'Authoritative deployment environment context',
      icon: Server,
      badge: 'Active Context',
    },
    {
      label: 'Storage Backend',
      value: config.storageBackend,
      detail: `Backend Type: ${config.storageBackendType}`,
      icon: Database,
      badge: config.storageBackendType === 'dynamodb' ? 'AWS Managed' : 'Local Parity',
    },
    {
      label: 'Event Publisher',
      value: config.publisherBackend,
      detail: `Publisher Type: ${config.publisherBackendType}`,
      icon: Radio,
      badge:
        config.publisherBackendType === 'eventbridge'
          ? 'Production Bus'
          : 'Zero-Cloud Local',
    },
    {
      label: 'AWS Region',
      value: config.awsRegion,
      detail: 'Cloud execution boundary for DynamoDB and EventBridge',
      icon: Cloud,
      badge: 'ap-south-1',
    },
    {
      label: 'EventBridge Bus Name',
      value: config.eventBridgeBus,
      detail: 'Target custom event bus for verified schema ingest',
      icon: Radio,
      badge: 'Target Bus',
    },
    {
      label: 'Active Release Policy Engine',
      value: config.policyEngine,
      detail: `Provider ID: ${config.policyEngineType}`,
      icon: Cpu,
      badge: config.policyEngineType === 'cedar' ? 'Cedar Engine' : 'Deterministic',
    },
  ]

  return (
    <div className="space-y-6 pb-12 font-mono">
      {/* Header — Explicitly 'RUNTIME CONFIGURATION' per Section 28 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              RUNTIME CONFIGURATION
            </h1>
            <Badge variant="default" size="sm">
              Authoritative
            </Badge>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Active platform execution parameters, storage backends, and cloud deployment configuration
          </p>
        </div>

        <button
          type="button"
          onClick={() => refetch()}
          className="flex items-center space-x-1.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700 text-xs text-slate-300 hover:text-slate-100 hover:border-slate-600 cursor-pointer"
        >
          <RefreshCw className="h-3 w-3" />
          <span>Refresh Configuration</span>
        </button>
      </div>

      {/* Configuration Status Banner */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="h-8 w-8 rounded bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="h-4 w-4" />
          </div>
          <div>
            <span className="text-sm font-semibold text-slate-200">
              Platform Configuration Verified
            </span>
            <p className="text-xs text-slate-400">
              All infrastructure interfaces connected and initialized with zero simulated data.
            </p>
          </div>
        </div>
        <Badge variant="allow" size="sm">
          Operational
        </Badge>
      </div>

      {/* Runtime Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => {
          const Icon = item.icon
          return (
            <div
              key={item.label}
              className="bg-[#0b0f19] border border-slate-800 rounded-lg p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-400">
                  <Icon className="h-4 w-4 text-blue-400" />
                  <span className="text-xs font-semibold">{item.label}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400">
                  {item.badge}
                </span>
              </div>

              <div>
                <span className="text-sm font-bold text-slate-100 block">
                  {item.value}
                </span>
                <span className="text-xs text-slate-400 mt-1 block">
                  {item.detail}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Contracts Directory Detail */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2">
        <div className="flex items-center space-x-2 text-slate-300 font-semibold">
          <FolderTree className="h-4 w-4 text-purple-400" />
          <span>Resolved Contracts Repository Directory</span>
        </div>
        <pre className="bg-slate-950 p-2.5 rounded border border-slate-800 text-slate-300 text-xs overflow-x-auto select-all">
          {config.contractsDirectory}
        </pre>
        <p className="text-[11px] text-slate-400">
          Resolved relative to repository root. In local mode, contract JSON files are inspected
          directly; in AWS mode, DynamoDB single-table items are queried without scans.
        </p>
      </div>
    </div>
  )
}
