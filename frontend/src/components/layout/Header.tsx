import { Command, HelpCircle, RefreshCw } from 'lucide-react'
import { EventGateLogo } from '@/components/ui/EventGateLogo'
import { cn } from '@/lib/utils'
import { ROUTE_LABELS, ROUTES, type Route } from '@/lib/route'
import { useHealth } from '@/services/queries'
import { ENVIRONMENTS, type Environment } from '@/types/api'

interface HeaderProps {
  route: Route
  onNavigate: (route: Route) => void
  environment: Environment
  onEnvironmentChange: (env: Environment) => void
  onOpenCommandPalette: () => void
  onOpenHelp: () => void
}

function NavTabs({
  route,
  onNavigate,
  className,
}: Pick<HeaderProps, 'route' | 'onNavigate'> & { className?: string }) {
  return (
    <nav aria-label="Primary" className={className}>
      <ul className="flex items-center gap-1">
        {ROUTES.map((r) => {
          const active = r === route
          return (
            <li key={r}>
              <a
                href={`#/${r}`}
                aria-current={active ? 'page' : undefined}
                onClick={(e) => {
                  e.preventDefault()
                  onNavigate(r)
                }}
                className={cn(
                  'block rounded-[var(--radius-control)] px-3 py-1.5 text-sm whitespace-nowrap transition-colors duration-150',
                  active ? 'bg-raised font-medium text-fg' : 'text-fg-subtle hover:bg-raised/60 hover:text-fg'
                )}
              >
                {ROUTE_LABELS[r]}
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function ApiStatus() {
  const health = useHealth()
  const online = health.isSuccess && health.data.status === 'ok'
  const label = health.isPending ? 'Checking API' : online ? 'API online' : 'API unreachable'
  return (
    <button
      type="button"
      onClick={() => health.refetch()}
      title={online ? `EventGate ${health.data?.version}. Click to re-check.` : 'Click to retry'}
      className="inline-flex h-8 items-center gap-2 rounded-[var(--radius-control)] border border-line px-2.5 text-xs text-fg-muted transition-colors hover:border-line-strong hover:text-fg"
    >
      {health.isFetching ? (
        <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
      ) : (
        <span
          aria-hidden="true"
          className={cn('h-2 w-2 rounded-full', online ? 'bg-success' : 'bg-danger')}
        />
      )}
      <span>{label}</span>
      {!online && !health.isFetching && <span className="text-accent-fg">Retry</span>}
    </button>
  )
}

export function Header({
  route,
  onNavigate,
  environment,
  onEnvironmentChange,
  onOpenCommandPalette,
  onOpenHelp,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/95 backdrop-blur-sm">
      <div className="mx-auto flex h-14 max-w-screen-2xl items-center gap-4 px-4 sm:px-6">
        <a
          href="#/review"
          onClick={(e) => {
            e.preventDefault()
            onNavigate('review')
          }}
          className="flex shrink-0 items-center gap-2 rounded text-fg"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md border border-accent-strong/50 bg-accent-tint text-accent-fg">
            <EventGateLogo className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold">EventGate</span>
        </a>

        <NavTabs route={route} onNavigate={onNavigate} className="hidden lg:block" />

        <div className="ml-auto flex items-center gap-2">
          <label className="sr-only" htmlFor="env-selector">
            Release target environment
          </label>
          <select
            id="env-selector"
            value={environment}
            onChange={(e) => onEnvironmentChange(e.target.value as Environment)}
            title="Release target environment"
            className="h-8 cursor-pointer rounded-[var(--radius-control)] border border-line bg-surface px-2 text-xs text-fg transition-colors hover:border-line-strong"
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env} value={env}>
                {env}
              </option>
            ))}
          </select>
          <div className="hidden sm:block">
            <ApiStatus />
          </div>
          <button
            type="button"
            onClick={onOpenCommandPalette}
            className="hidden h-8 items-center gap-2 rounded-[var(--radius-control)] border border-line px-2.5 text-xs text-fg-subtle transition-colors hover:border-line-strong hover:text-fg md:inline-flex"
          >
            <Command className="h-3.5 w-3.5" aria-hidden="true" />
            <span>Commands</span>
            <kbd className="rounded border border-line px-1 text-[11px]">Ctrl K</kbd>
          </button>
          <button
            type="button"
            onClick={onOpenHelp}
            aria-label="Keyboard shortcuts and help"
            className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-control)] border border-line text-fg-subtle transition-colors hover:border-line-strong hover:text-fg"
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="flex items-center gap-2 overflow-x-auto border-t border-line px-4 py-1.5 sm:px-6 lg:hidden">
        <NavTabs route={route} onNavigate={onNavigate} />
        <div className="ml-auto shrink-0 sm:hidden">
          <ApiStatus />
        </div>
      </div>
    </header>
  )
}
