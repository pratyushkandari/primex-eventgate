import * as React from 'react'
import { ShieldCheck, Cloud, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react'
import { API_CONFIG } from '@/config/env'
import { eventGateApi } from '@/services/api'
import { Badge } from '@/components/ui/Badge'

export function Header() {
  const [healthStatus, setHealthStatus] = React.useState<'checking' | 'healthy' | 'unreachable'>('checking')
  const [apiVersion, setApiVersion] = React.useState<string | null>(null)

  const verifyHealth = React.useCallback(async () => {
    setHealthStatus('checking')
    try {
      const res = await eventGateApi.checkHealth()
      if (res.status === 'ok') {
        setHealthStatus('healthy')
        setApiVersion(res.version)
      } else {
        setHealthStatus('unreachable')
      }
    } catch {
      setHealthStatus('unreachable')
    }
  }, [])

  React.useEffect(() => {
    verifyHealth()
  }, [verifyHealth])

  return (
    <header className="border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Left: Branding & Tagline */}
        <div className="flex items-center space-x-3">
          <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white">PrimeX EventGate</span>
              <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                v{apiVersion || '0.1.0'}
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Break it before it breaks — Consumer-aware cloud event enforcement
            </p>
          </div>
        </div>

        {/* Right: AWS Status & Health Indicator */}
        <div className="flex items-center space-x-3">
          <div className="hidden md:flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800 rounded-md px-2.5 py-1">
            <Cloud className="h-3.5 w-3.5 text-blue-400" />
            <span>AWS {API_CONFIG.region}</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-300">{API_CONFIG.stackName}</span>
          </div>

          <div
            className="flex items-center space-x-2 bg-slate-900/90 border border-slate-800 rounded-md px-2.5 py-1 cursor-pointer hover:border-slate-700 transition-colors"
            onClick={verifyHealth}
            title="Click to re-verify live backend health"
          >
            {healthStatus === 'checking' && (
              <>
                <RefreshCw className="h-3.5 w-3.5 text-slate-400 animate-spin" />
                <span className="text-xs font-mono text-slate-400">Connecting...</span>
              </>
            )}
            {healthStatus === 'healthy' && (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                <span className="text-xs font-mono text-emerald-400 font-medium">API Live</span>
              </>
            )}
            {healthStatus === 'unreachable' && (
              <>
                <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
                <span className="text-xs font-mono text-rose-400 font-medium">Offline</span>
              </>
            )}
          </div>

          <Badge variant="outline" className="hidden lg:inline-flex text-[11px] text-slate-400">
            Phase 4 Foundation
          </Badge>
        </div>
      </div>
    </header>
  )
}
