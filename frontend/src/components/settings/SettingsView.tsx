import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { CopyButton } from '@/components/ui/CopyButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { ErrorState, SkeletonRows } from '@/components/ui/States'
import { API_CONFIG } from '@/config/env'
import { useRuntimeConfig } from '@/services/queries'

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
      <dt className="text-sm text-fg-subtle sm:w-56 sm:shrink-0">{label}</dt>
      <dd className={mono ? 'font-mono text-sm break-all text-fg' : 'text-sm text-fg'}>{value}</dd>
    </div>
  )
}

/** Read-only view of the adapters the API is running with (GET /api/v1/config/runtime). */
export function SettingsView() {
  const config = useRuntimeConfig()

  return (
    <div>
      <PageHeader
        title="Runtime configuration"
        description="Read from the running API. Change it with the environment variables listed in .env.example."
        actions={
          <Button variant="secondary" size="sm" onClick={() => config.refetch()} isLoading={config.isFetching}>
            {!config.isFetching && <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />}
            Refresh
          </Button>
        }
      />

      <div className="space-y-4">
        <Card>
          <CardHeader title="Console" />
          <dl className="divide-y divide-line px-4">
            <div className="flex flex-col gap-0.5 py-2.5 sm:flex-row sm:items-center sm:gap-4">
              <dt className="text-sm text-fg-subtle sm:w-56 sm:shrink-0">API base URL</dt>
              <dd className="flex items-center gap-2 font-mono text-sm break-all text-fg">
                {API_CONFIG.baseUrl}
                <CopyButton value={API_CONFIG.baseUrl} label="Copy API base URL" />
              </dd>
            </div>
          </dl>
        </Card>

        {config.isPending ? (
          <SkeletonRows label="Loading runtime configuration" />
        ) : config.isError ? (
          <ErrorState
            title="Could not load the runtime configuration"
            error={config.error}
            hint="Check that the API is reachable, then retry."
            onRetry={() => config.refetch()}
          />
        ) : (
          <Card>
            <CardHeader title="API" description={`EventGate ${config.data.serviceVersion}`} />
            <dl className="divide-y divide-line px-4">
              <Row label="Contract storage" value={config.data.storageBackend} />
              <Row label="Contracts source" value={config.data.contractsSource} mono />
              <Row label="Release history store" value={config.data.historyStore} mono />
              <Row label="Event publisher" value={config.data.publisherBackend} />
              {config.data.eventBridgeBus && <Row label="EventBridge bus" value={config.data.eventBridgeBus} mono />}
              <Row label="AWS region" value={config.data.awsRegion} mono />
              <Row label="Policy engine" value={config.data.policyEngine} />
            </dl>
          </Card>
        )}
      </div>
    </div>
  )
}
