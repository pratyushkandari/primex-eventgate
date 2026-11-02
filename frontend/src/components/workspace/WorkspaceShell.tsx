/**
 * App shell: header, page routing, global keyboard shortcuts, command palette
 * and help dialog. Owns the release-target environment and the Review session
 * so other pages can open a change in Review without losing it on navigation.
 */

import * as React from 'react'
import {
  Database,
  FileCode,
  Globe,
  HelpCircle,
  History as HistoryIcon,
  Play,
  RotateCcw,
  Send,
  Settings as SettingsIcon,
  Shield,
  Sparkles,
  Terminal,
} from 'lucide-react'
import { Header } from '@/components/layout/Header'
import { CommandPalette, type CommandItem } from '@/components/workspace/CommandPalette'
import { ShortcutsHelpModal } from '@/components/workspace/ShortcutsHelpModal'
import { ReviewWorkspace } from '@/components/workspace/ReviewWorkspace'
import { useReviewSession, type ChangeSelection } from '@/components/workspace/useReviewSession'
import { Spinner } from '@/components/ui/States'
import { API_CONFIG } from '@/config/env'
import { SCENARIO_LIST } from '@/data/scenarios'
import { ROUTE_LABELS, useHashRoute, type Route } from '@/lib/route'
import { useRuntimeConfig } from '@/services/queries'
import { ENVIRONMENTS, type Environment } from '@/types/api'

const ContractsHub = React.lazy(() =>
  import('@/components/contracts/ContractsHub').then((m) => ({ default: m.ContractsHub }))
)
const ReleaseHistoryView = React.lazy(() =>
  import('@/components/history/ReleaseHistoryView').then((m) => ({ default: m.ReleaseHistoryView }))
)
const DeveloperToolsView = React.lazy(() =>
  import('@/components/devtools/DeveloperToolsView').then((m) => ({ default: m.DeveloperToolsView }))
)
const PoliciesView = React.lazy(() =>
  import('@/components/policies/PoliciesView').then((m) => ({ default: m.PoliciesView }))
)
const SettingsView = React.lazy(() =>
  import('@/components/settings/SettingsView').then((m) => ({ default: m.SettingsView }))
)

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)
}

export function WorkspaceShell() {
  const [route, navigate] = useHashRoute()
  const [environment, setEnvironment] = React.useState<Environment>('production')
  const [paletteOpen, setPaletteOpen] = React.useState(false)
  const [helpOpen, setHelpOpen] = React.useState(false)
  const session = useReviewSession(environment)
  const runtime = useRuntimeConfig()

  const { resetResults } = session
  const changeEnvironment = React.useCallback(
    (env: Environment) => {
      setEnvironment(env)
      resetResults()
    },
    [resetResults]
  )

  const openInReview = React.useCallback(
    (change: ChangeSelection) => {
      session.openChange(change)
      navigate('review')
    },
    [session, navigate]
  )

  // Results and failures are shown inline on the Review page.
  const runAnalysis = React.useCallback(async () => {
    await session.analyze()
  }, [session])

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setPaletteOpen((open) => !open)
      } else if (mod && e.key === 'Enter' && route === 'review') {
        e.preventDefault()
        void runAnalysis()
      } else if (e.key === '?' && !mod && !isTypingTarget(e.target)) {
        e.preventDefault()
        setHelpOpen(true)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [route, runAnalysis])

  const commands = React.useMemo<CommandItem[]>(() => {
    const pageIcons: Record<Route, CommandItem['icon']> = {
      review: FileCode,
      contracts: Database,
      history: HistoryIcon,
      devtools: Terminal,
      policies: Shield,
      settings: SettingsIcon,
    }
    const items: CommandItem[] = (Object.keys(pageIcons) as Route[]).map((r) => ({
      id: `nav-${r}`,
      title: `Go to ${ROUTE_LABELS[r]}`,
      category: 'Navigation',
      icon: pageIcons[r],
      onSelect: () => navigate(r),
    }))
    items.push(
      {
        id: 'cmd-analyze',
        title: 'Analyze compatibility',
        description: `${session.selection.eventType} v${session.selection.currentVersion} → v${session.selection.proposedVersion} in ${environment}`,
        category: 'Actions',
        icon: Play,
        shortcut: 'Ctrl Enter',
        disabled: session.isAnalyzing || Boolean(session.jsonError),
        onSelect: () => {
          navigate('review')
          void runAnalysis()
        },
      },
      {
        id: 'cmd-publish',
        title: 'Publish event',
        description: 'Available after an ALLOW decision',
        category: 'Actions',
        icon: Send,
        disabled: session.analysis?.decision !== 'ALLOW' || session.isPublishing,
        onSelect: () => navigate('review'),
      },
      {
        id: 'cmd-reset',
        title: 'Reset payload',
        description: 'Restore the sample payload for the selected change',
        category: 'Actions',
        icon: RotateCcw,
        onSelect: () => session.resetPayload(),
      },
      ...SCENARIO_LIST.map<CommandItem>((s) => ({
        id: `cmd-scenario-${s.id}`,
        title: `Sample: ${s.action}`,
        description: `${s.eventType} v${s.currentVersion} → v${s.proposedVersion}. ${s.description}`,
        category: 'Samples',
        keywords: [s.label, s.expectedDecision],
        icon: Sparkles,
        onSelect: () => {
          session.selectScenario(s.id)
          navigate('review')
        },
      })),
      ...ENVIRONMENTS.map<CommandItem>((env) => ({
        id: `cmd-env-${env}`,
        title: `Target ${env}`,
        description: env === environment ? 'Current environment' : undefined,
        category: 'Environment',
        icon: Globe,
        onSelect: () => changeEnvironment(env),
      })),
      {
        id: 'cmd-help',
        title: 'Keyboard shortcuts',
        category: 'Help',
        icon: HelpCircle,
        shortcut: '?',
        onSelect: () => setHelpOpen(true),
      }
    )
    return items
  }, [navigate, session, environment, runAnalysis, changeEnvironment])

  return (
    <div className="flex min-h-screen flex-col bg-canvas text-fg">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-2 focus:z-50 focus:rounded focus:bg-raised focus:px-3 focus:py-2"
      >
        Skip to content
      </a>
      <Header
        route={route}
        onNavigate={navigate}
        environment={environment}
        onEnvironmentChange={changeEnvironment}
        onOpenCommandPalette={() => setPaletteOpen(true)}
        onOpenHelp={() => setHelpOpen(true)}
      />

      <main id="main" className="mx-auto w-full max-w-screen-2xl flex-1 px-4 py-5 sm:px-6">
        <React.Suspense fallback={<Spinner label="Loading page" className="py-10" />}>
          {route === 'review' && (
            <ReviewWorkspace
              session={session}
              environment={environment}
              publisherBackendType={runtime.data?.publisherBackendType}
              eventBridgeBus={runtime.data?.eventBridgeBus ?? null}
              onAnalyze={runAnalysis}
            />
          )}
          {route === 'contracts' && <ContractsHub onOpenReview={openInReview} />}
          {route === 'history' && <ReleaseHistoryView onOpenReview={openInReview} />}
          {route === 'devtools' && <DeveloperToolsView onOpenReview={openInReview} environment={environment} />}
          {route === 'policies' && <PoliciesView />}
          {route === 'settings' && <SettingsView />}
        </React.Suspense>
      </main>

      <footer className="border-t border-line py-3 text-xs text-fg-subtle">
        <div className="mx-auto flex max-w-screen-2xl flex-col gap-1 px-4 sm:flex-row sm:justify-between sm:px-6">
          <span>EventGate {runtime.data?.serviceVersion ?? ''}</span>
          <span className="break-all">API: {API_CONFIG.baseUrl}</span>
        </div>
      </footer>

      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} commands={commands} />
      <ShortcutsHelpModal isOpen={helpOpen} onClose={() => setHelpOpen(false)} />
    </div>
  )
}
