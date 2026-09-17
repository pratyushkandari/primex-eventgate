import * as React from 'react'
import { Header } from '@/components/layout/Header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Sparkles, ArrowRight, Layers, Radio, Activity, Send } from 'lucide-react'

export function WorkspaceShell() {
  const [selectedScenario, setSelectedScenario] = React.useState<'safe' | 'breaking' | 'risk'>('safe')

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Scenario Quick Selector Banner for Judges */}
        <section className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="h-8 w-8 rounded-md bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Interactive Demo Scenarios</h2>
              <p className="text-xs text-slate-400">
                Pre-configured contract transitions evaluating real consumer impact
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={selectedScenario === 'safe' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedScenario('safe')}
              className="text-xs font-mono"
            >
              1. SAFE (v1 → v2)
            </Button>
            <Button
              variant={selectedScenario === 'breaking' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedScenario('breaking')}
              className="text-xs font-mono"
            >
              2. BREAKING (v1 → v3)
            </Button>
            <Button
              variant={selectedScenario === 'risk' ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setSelectedScenario('risk')}
              className="text-xs font-mono"
            >
              3. RISK (v1 → v4)
            </Button>
          </div>
        </section>

        {/* 3-Column Core Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: Input & Contract Selection Area (Col 4) */}
          <section className="lg:col-span-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Layers className="h-4 w-4 text-blue-400" />
                    <span>Contract & Payload</span>
                  </CardTitle>
                  <Badge variant="neutral">Input</Badge>
                </div>
                <CardDescription>
                  Configure the event evolution and test payload
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                    Event Type
                  </label>
                  <input
                    type="text"
                    value="OrderPlaced"
                    readOnly
                    className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                      Current Version
                    </label>
                    <input
                      type="text"
                      value="v1"
                      readOnly
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-slate-300 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-mono uppercase text-slate-400 mb-1">
                      Proposed Version
                    </label>
                    <input
                      type="text"
                      value={selectedScenario === 'safe' ? 'v2' : selectedScenario === 'breaking' ? 'v3' : 'v4'}
                      readOnly
                      className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-1.5 text-xs font-mono text-blue-400 font-semibold focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-mono uppercase text-slate-400">
                      Event Payload (JSON)
                    </label>
                    <span className="text-[10px] text-slate-500 font-mono">Conforms to proposed</span>
                  </div>
                  <div className="bg-slate-950 border border-slate-800 rounded-md p-3 font-mono text-xs text-slate-300 h-44 overflow-y-auto">
                    <pre className="text-[11px] leading-relaxed">
{JSON.stringify(
  {
    orderId: "ord-101",
    customerId: "cust-202",
    totalAmount: 149.99,
    items: [{ sku: "ITEM-A", quantity: 2, price: 49.99 }],
    shippingMethod: selectedScenario === 'breaking' ? { provider: "fedex" } : "standard",
    ...(selectedScenario === 'safe' ? { metadata: { source: "web-checkout" } } : {})
  },
  null,
  2
)}
                    </pre>
                  </div>
                </div>

                <div className="pt-2">
                  <Button className="w-full" size="md">
                    <Activity className="h-4 w-4 mr-1" />
                    <span>Analyze Compatibility</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* CENTER: Compatibility Decision Hero (Col 4) */}
          <section className="lg:col-span-4 space-y-4">
            <Card className="border-slate-800 bg-slate-900/80">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Radio className="h-4 w-4 text-indigo-400" />
                    <span>Deterministic Gate</span>
                  </CardTitle>
                  <Badge variant="neutral">Decision Engine</Badge>
                </div>
                <CardDescription>
                  Mathematical consensus across all registered consumer contracts
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center space-y-4">
                {selectedScenario === 'safe' && (
                  <>
                    <div className="h-20 w-20 rounded-full bg-emerald-500/10 border-2 border-emerald-500/40 flex items-center justify-center shadow-lg shadow-emerald-500/10">
                      <span className="text-2xl font-bold font-mono text-emerald-400">ALLOW</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">Safe for All Consumers</h3>
                      <p className="text-xs text-slate-400 max-w-xs mt-1">
                        Optional field added. 3 of 3 registered consumers remain unaffected.
                      </p>
                    </div>
                    <Badge variant="safe">SEVERITY: LOW</Badge>
                    <div className="w-full pt-4">
                      <Button variant="success" className="w-full">
                        <Send className="h-4 w-4 mr-2" />
                        Publish to EventBridge
                      </Button>
                    </div>
                  </>
                )}

                {selectedScenario === 'breaking' && (
                  <>
                    <div className="h-20 w-20 rounded-full bg-rose-500/10 border-2 border-rose-500/40 flex items-center justify-center shadow-lg shadow-rose-500/10">
                      <span className="text-2xl font-bold font-mono text-rose-400">BLOCK</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">Breaking Change Intercepted</h3>
                      <p className="text-xs text-slate-400 max-w-xs mt-1">
                        Type incompatibility detected in 1 consumer. EventBridge publication prevented.
                      </p>
                    </div>
                    <Badge variant="block">SEVERITY: HIGH</Badge>
                    <div className="w-full pt-4">
                      <Button variant="outline" disabled className="w-full opacity-60">
                        Publication Prevented
                      </Button>
                    </div>
                  </>
                )}

                {selectedScenario === 'risk' && (
                  <>
                    <div className="h-20 w-20 rounded-full bg-amber-500/10 border-2 border-amber-500/40 flex items-center justify-center shadow-lg shadow-amber-500/10">
                      <span className="text-xl font-bold font-mono text-amber-400">REVIEW</span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold text-white">Review Required</h3>
                      <p className="text-xs text-slate-400 max-w-xs mt-1">
                        Field removal detected in optional dependency. Publication halted pending approval.
                      </p>
                    </div>
                    <Badge variant="review">SEVERITY: MEDIUM</Badge>
                    <div className="w-full pt-4">
                      <Button variant="outline" disabled className="w-full opacity-60">
                        Pending Sign-off
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </section>

          {/* RIGHT: Consumer Impact Breakdown (Col 4) */}
          <section className="lg:col-span-4 space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="h-4 w-4 text-emerald-400" />
                    <span>Downstream Impact</span>
                  </CardTitle>
                  <Badge variant="neutral">3 Consumers</Badge>
                </div>
                <CardDescription>
                  Real-time contract verification per registered microservice
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Billing Consumer Card */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">billing-service</span>
                    <Badge variant="safe" size="sm">SAFE</Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Rule EVT005 / EVT008: Consumer schema unaffected by proposed changes.
                  </p>
                </div>

                {/* Inventory Consumer Card */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">inventory-service</span>
                    <Badge variant={selectedScenario === 'breaking' ? 'break' : 'safe'} size="sm">
                      {selectedScenario === 'breaking' ? 'BREAK' : 'SAFE'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {selectedScenario === 'breaking'
                      ? "Rule EVT001: Field 'shippingMethod' type changed from string to object."
                      : "Rule EVT005: Optional fields added; contract fulfilled."}
                  </p>
                </div>

                {/* Analytics Consumer Card */}
                <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-200">analytics-service</span>
                    <Badge variant={selectedScenario === 'risk' ? 'risk' : 'safe'} size="sm">
                      {selectedScenario === 'risk' ? 'RISK' : 'SAFE'}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    {selectedScenario === 'risk'
                      ? "Rule EVT006: Optional field 'couponCode' was removed."
                      : "Rule EVT005 / EVT008: Telemetry schema compatible."}
                  </p>
                </div>
              </CardContent>
            </Card>
          </section>
        </div>

        {/* BOTTOM: Event Flow Architecture Visualization */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-mono uppercase tracking-wider text-slate-400 flex items-center space-x-2">
              <span>Cloud Transport Flow</span>
              <span className="text-slate-600">•</span>
              <span className="text-slate-500">Live Amazon EventBridge Routing</span>
            </h3>
            <span className="text-xs text-slate-500 font-mono">
              Bus: primex-eventgate-dev-bus
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-center text-center">
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <span className="block text-xs font-semibold text-slate-200">Producer</span>
              <span className="text-[11px] font-mono text-slate-400">API Gateway HTTP API</span>
            </div>

            <div className="hidden md:flex justify-center text-slate-600">
              <ArrowRight className="h-4 w-4" />
            </div>

            <div className="bg-slate-950 border border-blue-500/30 rounded-lg p-3">
              <span className="block text-xs font-semibold text-blue-400">EventGate Core</span>
              <span className="text-[11px] font-mono text-slate-400">Payload + Consumer Gate</span>
            </div>

            <div className="hidden md:flex justify-center text-slate-600">
              <ArrowRight className="h-4 w-4" />
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-lg p-3">
              <span className="block text-xs font-semibold text-slate-200">Amazon EventBridge</span>
              <span className="text-[11px] font-mono text-slate-400">Fan-Out to 3 Consumers</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
