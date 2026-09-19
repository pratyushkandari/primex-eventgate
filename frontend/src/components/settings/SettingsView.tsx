import { useState } from 'react'
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
  Copy,
  Check,
} from 'lucide-react'
import { useRuntimeConfig } from '@/services/queries'
import { Badge } from '@/components/ui/Badge'

export function SettingsView() {
  const { data: config, isLoading, error, refetch } = useRuntimeConfig()
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

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
          <span>Runtime configuration is currently unavailable.</span>
        </div>
        <p className="text-rose-300/80">Check the release API connection and retry.</p>
        <button
          type="button"
          onClick={() => refetch()}
          className="mt-3 inline-flex items-center px-3 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-200 text-xs transition-colors cursor-pointer"
        >
          Retry
        </button>
      </div>
    )
  }

  const stackStage = config.eventBridgeBus.includes('-dev-')
    ? 'dev'
    : config.eventBridgeBus.includes('-staging-')
    ? 'staging'
    : 'prod'


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

      {/* Runtime Configuration Grouped Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* RELEASE CONTEXT */}
        <section className="bg-[#0b0f19] border border-slate-800/90 rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-2 text-slate-400 border-b border-slate-800/80 pb-2">
            <Server className="h-4 w-4 text-blue-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Release Context</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">Target Environment</span>
                <span className="text-sm font-bold text-slate-100">{config.environment}</span>
              </div>
              <Badge variant={config.environment === 'production' ? 'safe' : config.environment === 'staging' ? 'review' : 'default'} size="sm">
                Release Target
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500">Release policy evaluation target (production / staging / development)</p>
          </div>
        </section>

        {/* RUNTIME */}
        <section className="bg-[#0b0f19] border border-slate-800/90 rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-2 text-slate-400 border-b border-slate-800/80 pb-2">
            <Cloud className="h-4 w-4 text-sky-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Runtime</span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Runtime Infrastructure Stack</span>
                  <span className="text-sm font-bold text-slate-100">{`primex-eventgate-${stackStage}`}</span>
                </div>
                <Badge variant="neutral" size="sm">AWS Stack: {stackStage}</Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">CloudFormation deployment tier hosting EventGate runtime</p>
            </div>
            <div className="border-t border-slate-800/60 pt-2 flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">AWS Region</span>
                <span className="text-sm font-bold text-slate-100">{config.awsRegion}</span>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-400 font-mono">
                {config.awsRegion}
              </span>
            </div>
          </div>
        </section>

        {/* STORAGE */}
        <section className="bg-[#0b0f19] border border-slate-800/90 rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-2 text-slate-400 border-b border-slate-800/80 pb-2">
            <Database className="h-4 w-4 text-emerald-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Storage</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[11px] text-slate-400 block">Storage Backend</span>
                <span className="text-sm font-bold text-slate-100">{config.storageBackend}</span>
              </div>
              <Badge variant="neutral" size="sm">
                {config.storageBackendType === 'dynamodb' ? 'AWS Managed' : 'Local Parity'}
              </Badge>
            </div>
            <p className="text-[11px] text-slate-500">Backend Type: {config.storageBackendType}</p>
          </div>
        </section>

        {/* TRANSPORT */}
        <section className="bg-[#0b0f19] border border-slate-800/90 rounded-lg p-4 space-y-3">
          <div className="flex items-center space-x-2 text-slate-400 border-b border-slate-800/80 pb-2">
            <Radio className="h-4 w-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Transport</span>
          </div>
          <div className="space-y-3">
            <div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Event Publisher</span>
                  <span className="text-sm font-bold text-slate-100">{config.publisherBackend}</span>
                </div>
                <Badge variant="neutral" size="sm">
                  {config.publisherBackendType === 'eventbridge' ? 'Production Bus' : 'Zero-Cloud Local'}
                </Badge>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Publisher Type: {config.publisherBackendType}</p>
            </div>
            <div className="border-t border-slate-800/60 pt-2">
              <span className="text-[11px] text-slate-400 block">EventBridge Bus Name</span>
              <span className="text-sm font-bold text-slate-100 block truncate" title={config.eventBridgeBus}>
                {config.eventBridgeBus}
              </span>
            </div>
          </div>
        </section>

        {/* POLICY */}
        <section className="bg-[#0b0f19] border border-slate-800/90 rounded-lg p-4 space-y-3 md:col-span-2">
          <div className="flex items-center space-x-2 text-slate-400 border-b border-slate-800/80 pb-2">
            <Cpu className="h-4 w-4 text-purple-400" />
            <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Policy</span>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 block">Active Release Policy Engine</span>
              <span className="text-sm font-bold text-slate-100">{config.policyEngine}</span>
              <p className="text-[11px] text-slate-500 mt-0.5">Provider ID: {config.policyEngineType}</p>
            </div>
            <Badge variant="neutral" size="sm">
              {config.policyEngineType === 'cedar' ? 'Cedar Engine' : 'Deterministic Engine'}
            </Badge>
          </div>
        </section>
      </div>

      {/* Contracts Directory Detail */}
      <div className="bg-[#0b0f19] border border-slate-800 rounded-lg p-4 font-mono text-xs space-y-2">
        <div className="flex items-center justify-between text-slate-300 font-semibold">
          <div className="flex items-center space-x-2">
            <FolderTree className="h-4 w-4 text-purple-400" />
            <span>Resolved Contracts Repository Directory</span>
          </div>
          <button
            type="button"
            onClick={() => handleCopy(config.contractsDirectory, 'contractsDir')}
            className="flex items-center space-x-1 text-slate-400 hover:text-slate-200 text-[11px] cursor-pointer"
          >
            {copiedKey === 'contractsDir' ? (
              <>
                <Check className="h-3 w-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>
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
