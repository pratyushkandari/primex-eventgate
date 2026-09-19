import * as React from 'react'
import { Shield, RefreshCw, Cloud, HelpCircle, Command } from 'lucide-react'
import { API_CONFIG } from '@/config/env'
import { eventGateApi } from '@/services/api'
import type { Environment } from '@/types/api'

export type NavTab = 'review' | 'contracts' | 'history' | 'devtools' | 'policies' | 'settings'

interface HeaderProps {
  activeTab?: NavTab
  onSelectTab?: (tab: NavTab) => void
  onOpenCommandPalette?: () => void
  onOpenHelp?: () => void
  environment?: Environment
  onEnvironmentChange?: (env: Environment) => void
}



export function Header({
  activeTab = 'review',
  onSelectTab,
  onOpenCommandPalette,
  onOpenHelp,
  environment = 'production',
  onEnvironmentChange,
}: HeaderProps) {
  const [healthStatus, setHealthStatus] = React.useState<'checking' | 'healthy' | 'unreachable'>('checking')
  const [apiVersion, setApiVersion] = React.useState<string | null>(null)
  const [lastChecked, setLastChecked] = React.useState<string | null>(null)

  const performHealthCheck = React.useCallback(async () => {
    try {
      const res = await eventGateApi.checkHealth()
      if (res.status === 'ok') {
        setHealthStatus('healthy')
        setApiVersion(res.version)
        setLastChecked(new Date().toLocaleTimeString())
      } else {
        setHealthStatus('unreachable')
      }
    } catch {
      setHealthStatus('unreachable')
    }
  }, [])

  const handleManualRefresh = React.useCallback(async () => {
    setHealthStatus('checking')
    await performHealthCheck()
  }, [performHealthCheck])

  React.useEffect(() => {
    let ignore = false
    async function check() {
      try {
        const res = await eventGateApi.checkHealth()
        if (ignore) return
        if (res.status === 'ok') {
          setHealthStatus('healthy')
          setApiVersion(res.version)
          setLastChecked(new Date().toLocaleTimeString())
        } else {
          setHealthStatus('unreachable')
        }
      } catch {
        if (!ignore) {
          setHealthStatus('unreachable')
        }
      }
    }
    check()
    return () => {
      ignore = true
    }
  }, [])

  return (
    <header className="border-b border-slate-800 bg-[#0b0f19] sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
        {/* Left: Brand & Product Purpose */}
        <div className="flex items-center space-x-3">
          <div className="h-7 w-7 rounded bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Shield className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-sm tracking-tight text-slate-100">
                EventGate
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/60">
                v{apiVersion || '0.1.0'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono hidden sm:block">
              Event compatibility and release gating
            </p>
          </div>
        </div>

        {/* Center: Primary Navigation Tabs */}
        <nav className="hidden md:flex items-center space-x-1" aria-label="Primary Navigation">
          {[
            { id: 'review' as NavTab, label: 'Review' },
            { id: 'contracts' as NavTab, label: 'Contracts' },
            { id: 'history' as NavTab, label: 'History' },
            { id: 'devtools' as NavTab, label: 'Developer Tools' },
            { id: 'policies' as NavTab, label: 'Policies' },
            { id: 'settings' as NavTab, label: 'Settings' },
          ].map((tab) => {
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab?.(tab.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-800 text-slate-100 font-semibold shadow-xs border border-slate-700/80'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                {tab.label}
              </button>
            )
          })}
        </nav>

        {/* Command Palette Trigger Button */}
        {onOpenCommandPalette && (
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden xl:flex items-center space-x-2 bg-slate-900/90 hover:bg-slate-800/80 border border-slate-700/70 hover:border-slate-600 px-3 py-1 rounded-md text-xs font-mono text-slate-400 hover:text-slate-200 transition-all shadow-xs cursor-pointer"
            title="Open command palette (Ctrl+K / ⌘K)"
          >
            <Command className="h-3.5 w-3.5 text-slate-400" />
            <span>Command...</span>
            <kbd className="bg-slate-950 px-1.5 py-0.5 rounded border border-slate-800 text-[10px] text-slate-400">
              ⌘K
            </kbd>
          </button>
        )}

        {/* Right: Technical Metadata & Live Status */}
        <div className="flex items-center space-x-2 text-xs font-mono">
          {/* AWS Region */}
          <div className="hidden md:flex items-center space-x-1 bg-slate-900 border border-slate-800/80 px-2 py-1 rounded text-slate-400">
            <Cloud className="h-3 w-3 text-slate-500" />
            <span>{API_CONFIG.region}</span>
          </div>

          {/* Environment Selector */}
          <div className="hidden sm:flex items-center">
            {onEnvironmentChange ? (
              <button
                type="button"
                id="env-selector"
                onClick={() => {
                  const envs: Environment[] = ['development', 'staging', 'production']
                  const nextIndex = (envs.indexOf(environment) + 1) % envs.length
                  onEnvironmentChange(envs[nextIndex])
                }}
                title={`Active Environment: ${environment}. Click to toggle.`}
                aria-label={`Target Environment: ${environment}`}
                className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800/80 hover:border-slate-700 px-2.5 py-1 rounded text-slate-300 transition-colors cursor-pointer text-xs font-mono"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-blue-400" />
                <span>{environment === 'development' ? 'dev' : environment}</span>
              </button>
            ) : (
              <div className="bg-slate-900 border border-slate-800/80 px-2.5 py-1 rounded text-slate-400 text-xs font-mono">
                <span>{environment === 'development' ? 'dev' : environment}</span>
              </div>
            )}
          </div>

          {/* Health Status Indicator */}
          <button
            type="button"
            onClick={handleManualRefresh}
            title={`Click to re-verify live backend health${lastChecked ? ` (last checked: ${lastChecked})` : ''}`}
            aria-label={
              healthStatus === 'unreachable'
                ? 'API Unavailable - Click to retry connection'
                : 'API Health Status'
            }
            className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800/80 hover:border-slate-700 px-2.5 py-1 rounded text-xs transition-colors cursor-pointer"
          >
            {healthStatus === 'checking' && (
              <>
                <RefreshCw className="h-3 w-3 text-slate-400 animate-spin" />
                <span className="text-slate-400">Connecting...</span>
              </>
            )}
            {healthStatus === 'healthy' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                <span className="text-emerald-400 font-medium">API Healthy</span>
              </>
            )}
            {healthStatus === 'unreachable' && (
              <>
                <span className="h-1.5 w-1.5 rounded-full bg-rose-400" />
                <span className="text-rose-400 font-medium">API Unavailable</span>
                <span className="text-[10px] text-rose-300/80 underline ml-1">Retry</span>
              </>
            )}
          </button>

          {/* Docs / Help link or modal */}
          {onOpenHelp ? (
            <button
              type="button"
              onClick={onOpenHelp}
              title="View Keyboard Shortcuts & Guide"
              className="h-7 w-7 flex items-center justify-center rounded bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
              aria-label="Keyboard Shortcuts & Documentation"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          ) : (
            <a
              href="#rules"
              title="Compatibility rules: EVT001 - EVT008"
              className="h-7 w-7 flex items-center justify-center rounded bg-slate-900 border border-slate-800/80 hover:border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <HelpCircle className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Mobile/Tablet Tab Strip */}
      <div className="md:hidden border-t border-slate-800/80 bg-[#080d17] px-4 py-1.5 overflow-x-auto flex items-center space-x-1 scrollbar-none" aria-label="Mobile Navigation">
        {[
          { id: 'review' as NavTab, label: 'Review' },
          { id: 'contracts' as NavTab, label: 'Contracts' },
          { id: 'history' as NavTab, label: 'History' },
          { id: 'devtools' as NavTab, label: 'Dev Tools' },
          { id: 'policies' as NavTab, label: 'Policies' },
          { id: 'settings' as NavTab, label: 'Settings' },
        ].map((tab) => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onSelectTab?.(tab.id)}
              className={`px-2.5 py-1 rounded text-xs whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-slate-800 text-slate-100 font-semibold border border-slate-700'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          )
        })}
      </div>
    </header>
  )
}
