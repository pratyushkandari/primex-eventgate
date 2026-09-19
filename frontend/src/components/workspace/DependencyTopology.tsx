/**
 * DependencyTopology — Interactive blast radius graph using @xyflow/react.
 * Renders Producer → EventGate → Consumer fan-out with decision-aware edges.
 */

import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  type NodeTypes,
  type NodeProps,
  Handle,
  Position,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Network, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'
import type { AnalysisResponse, ConsumerStatus } from '@/types/api'
import { TopologyFallback } from '@/components/workspace/TopologyFallback'

interface DependencyTopologyProps {
  analysis: AnalysisResponse | null
  selectedConsumerId: string | null
  onSelectConsumer: (consumerId: string) => void
}

// ─── Custom Node Components ──────────────────────────────────────────

function ProducerNode({ data }: NodeProps) {
  return (
    <div className="p-3 rounded-lg border border-slate-700 bg-slate-900/95 min-w-[150px] shadow-sm font-mono">
      <span className="text-[10px] text-slate-500 uppercase tracking-wider block">
        Producer Contract
      </span>
      <span className="text-sm font-bold text-blue-400 block">{data.eventType as string}</span>
      <span className="text-[10px] text-slate-400 mt-1 block">
        v{data.currentVersion as number} → v{data.proposedVersion as number}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-blue-500 !w-2 !h-2 !border-0" />
    </div>
  )
}

function GateNode({ data }: NodeProps) {
  const decision = data.decision as string | null
  const borderColor =
    decision === 'ALLOW'
      ? 'border-emerald-500/50'
      : decision === 'BLOCK'
      ? 'border-rose-500/50'
      : decision === 'REVIEW'
      ? 'border-amber-500/50'
      : 'border-slate-700'
  const bgColor =
    decision === 'ALLOW'
      ? 'bg-emerald-950/30'
      : decision === 'BLOCK'
      ? 'bg-rose-950/30'
      : decision === 'REVIEW'
      ? 'bg-amber-950/30'
      : 'bg-slate-900/95'

  return (
    <div className={`p-3 rounded-lg border ${borderColor} ${bgColor} min-w-[160px] shadow-sm font-mono`}>
      <Handle type="target" position={Position.Left} className="!bg-slate-500 !w-2 !h-2 !border-0" />
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider opacity-80">Release Gate</span>
        {decision === 'ALLOW' && <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />}
        {decision === 'BLOCK' && <ShieldAlert className="h-3.5 w-3.5 text-rose-400" />}
        {decision === 'REVIEW' && <ShieldQuestion className="h-3.5 w-3.5 text-amber-400" />}
      </div>
      <span className={`text-sm font-bold mt-0.5 block ${
        decision === 'ALLOW' ? 'text-emerald-300' : decision === 'BLOCK' ? 'text-rose-300' : decision === 'REVIEW' ? 'text-amber-300' : 'text-slate-300'
      }`}>EventGate</span>
      <span className={`text-[10px] opacity-80 mt-1 block ${
        decision === 'ALLOW' ? 'text-emerald-400' : decision === 'BLOCK' ? 'text-rose-400' : decision === 'REVIEW' ? 'text-amber-400' : 'text-slate-500'
      }`}>
        {decision ? `Decision: ${decision}` : 'Ready for analysis'}
      </span>
      <Handle type="source" position={Position.Right} className="!bg-slate-500 !w-2 !h-2 !border-0" />
    </div>
  )
}

function ConsumerNode({ data }: NodeProps) {
  const status = data.status as ConsumerStatus
  const isSelected = data.isSelected as boolean
  const isMuted = data.isMuted as boolean
  const finding = data.finding as { field?: string; expectedType?: string | null; proposedType?: string | null } | null

  const borderColor =
    status === 'BREAK'
      ? 'border-rose-500/60'
      : status === 'RISK'
      ? 'border-amber-500/60'
      : 'border-slate-800'
  const bgColor =
    status === 'BREAK'
      ? 'bg-rose-950/30'
      : status === 'RISK'
      ? 'bg-amber-950/30'
      : 'bg-slate-900/95'

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof data.onSelect === 'function') {
          (data.onSelect as (id: string) => void)(data.consumerId as string)
        }
      }}
      className={`text-left w-full p-2.5 rounded-lg border ${borderColor} ${bgColor} min-w-[140px] shadow-sm font-mono cursor-pointer transition-all ${
        isSelected
          ? 'ring-2 ring-blue-500 scale-[1.02] opacity-100'
          : isMuted
          ? 'opacity-40 hover:opacity-90'
          : 'hover:border-slate-600'
      }`}
    >
      <Handle type="target" position={Position.Left} className="!bg-slate-500 !w-2 !h-2 !border-0" />
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-slate-200 truncate">{data.name as string}</span>
        <Badge variant={status.toLowerCase() as 'break' | 'risk' | 'safe'} size="sm">
          {status}
        </Badge>
      </div>
      <span className="text-[10px] text-slate-500 block truncate">{data.consumerId as string}</span>
      {status === 'BREAK' && finding && (
        <div className="text-[10px] text-rose-300 font-semibold truncate mt-1">
          {finding.field}: {finding.expectedType} → {finding.proposedType}
        </div>
      )}
      {status === 'RISK' && finding && (
        <div className="text-[10px] text-amber-300 font-semibold truncate mt-1">
          {finding.field} removed
        </div>
      )}
      {status === 'SAFE' && (
        <span className="text-[10px] text-emerald-400/80 block mt-1">Compatible</span>
      )}
    </button>
  )
}

const nodeTypes: NodeTypes = {
  producer: ProducerNode,
  gate: GateNode,
  consumer: ConsumerNode,
}

// ─── Layout constants ────────────────────────────────────────────────

const PRODUCER_X = 0
const GATE_X = 260
const CONSUMER_X = 520
const CONSUMER_Y_START = -60
const CONSUMER_Y_GAP = 100

// ─── Main Component ──────────────────────────────────────────────────

export function DependencyTopology({
  analysis,
  selectedConsumerId,
  onSelectConsumer,
}: DependencyTopologyProps) {
  // Derive consumers from analysis findings or use defaults
  const consumers = useMemo(() => {
    const defaultConsumers = [
      { id: 'billing-service', name: 'Billing' },
      { id: 'inventory-service', name: 'Inventory' },
      { id: 'analytics-service', name: 'Analytics' },
    ]

    if (!analysis) return defaultConsumers

    // Build consumer list from findings, ensuring all known consumers are represented
    const fromFindings = analysis.findings.map((f) => ({
      id: f.consumerId,
      name: f.consumerId.replace(/-service$/, '').replace(/^\w/, (c) => c.toUpperCase()),
    }))

    // Merge: include findings consumers + defaults not already present
    const seen = new Set(fromFindings.map((f) => f.id))
    const merged = [...fromFindings]
    for (const dc of defaultConsumers) {
      if (!seen.has(dc.id)) {
        merged.push(dc)
      }
    }
    return merged
  }, [analysis])

  const getConsumerStatus = useCallback(
    (id: string): ConsumerStatus => {
      if (!analysis) return 'SAFE'
      const finding = analysis.findings.find((f) => f.consumerId === id)
      return finding ? finding.status : 'SAFE'
    },
    [analysis]
  )

  const getConsumerFinding = useCallback(
    (id: string) => {
      if (!analysis) return null
      return analysis.findings.find((f) => f.consumerId === id) || null
    },
    [analysis]
  )

  const gateDecision = analysis?.decision ?? null

  // Build deterministic nodes
  const nodes = useMemo<Node[]>(() => {
    const consumerYCenter = ((consumers.length - 1) * CONSUMER_Y_GAP) / 2
    const currentNodes: Node[] = [
      {
        id: 'producer',
        type: 'producer',
        position: { x: PRODUCER_X, y: consumerYCenter - 20 },
        data: {
          eventType: analysis?.eventType || 'OrderPlaced',
          currentVersion: analysis?.currentVersion ?? 1,
          proposedVersion: analysis?.proposedVersion ?? 2,
        },
        draggable: false,
      },
      {
        id: 'gate',
        type: 'gate',
        position: { x: GATE_X, y: consumerYCenter - 20 },
        data: { decision: gateDecision },
        draggable: false,
      },
    ]

    const hasImpactedConsumers = consumers.some((c) => getConsumerStatus(c.id) !== 'SAFE')

    consumers.forEach((c, i) => {
      const status = getConsumerStatus(c.id)
      const finding = getConsumerFinding(c.id)
      const isMuted = selectedConsumerId
        ? selectedConsumerId !== c.id
        : hasImpactedConsumers && status === 'SAFE'

      currentNodes.push({
        id: c.id,
        type: 'consumer',
        position: { x: CONSUMER_X, y: CONSUMER_Y_START + i * CONSUMER_Y_GAP },
        data: {
          consumerId: c.id,
          name: c.name,
          status,
          isSelected: selectedConsumerId === c.id,
          isMuted,
          finding: finding
            ? { field: finding.field, expectedType: finding.expectedType, proposedType: finding.proposedType }
            : null,
          onSelect: onSelectConsumer,
        },
        draggable: false,
      })
    })

    return currentNodes
  }, [analysis, gateDecision, consumers, selectedConsumerId, getConsumerStatus, getConsumerFinding, onSelectConsumer])

  // Build deterministic edges
  const edges = useMemo<Edge[]>(() => {
    const currentEdges: Edge[] = [
      {
        id: 'producer-gate',
        source: 'producer',
        target: 'gate',
        animated: gateDecision === 'ALLOW',
        style: {
          stroke: gateDecision === 'ALLOW' ? '#34d399' : gateDecision === 'BLOCK' ? '#f87171' : gateDecision === 'REVIEW' ? '#fbbf24' : '#475569',
          strokeWidth: 2,
        },
      },
    ]

    consumers.forEach((c) => {
      const status = getConsumerStatus(c.id)
      const isBlocked = gateDecision === 'BLOCK' || gateDecision === 'REVIEW'
      currentEdges.push({
        id: `gate-${c.id}`,
        source: 'gate',
        target: c.id,
        animated: gateDecision === 'ALLOW' && status === 'SAFE',
        style: {
          stroke:
            isBlocked && status === 'BREAK'
              ? '#f87171'
              : isBlocked && status === 'RISK'
              ? '#fbbf24'
              : isBlocked
              ? '#334155'
              : status === 'SAFE'
              ? '#34d399'
              : '#475569',
          strokeWidth: status === 'BREAK' ? 2 : 1.5,
          strokeDasharray: status === 'BREAK' ? '6 4' : status === 'RISK' ? '4 4' : undefined,
        },
      })
    })

    return currentEdges
  }, [gateDecision, consumers, getConsumerStatus])

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.type === 'consumer') {
        onSelectConsumer(node.id)
      }
    },
    [onSelectConsumer]
  )

  return (
    <Card className="border-slate-800 bg-[#0c1220]/80">
      <CardHeader className="py-3 px-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <Network className="h-3.5 w-3.5 text-blue-400" />
            <span>Dependency Topology</span>
          </CardTitle>
          <span className="text-[10px] text-slate-500 font-mono">
            Interactive Node Map • Click to inspect
          </span>
        </div>
      </CardHeader>

      <CardContent className="p-0 font-mono">
        <div className="h-[280px] w-full relative" role="img" aria-label="Event dependency topology graph">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={handleNodeClick}
            fitView
            fitViewOptions={{ padding: 0.3 }}
            proOptions={{ hideAttribution: true }}
            minZoom={0.5}
            maxZoom={1.5}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            panOnDrag
            zoomOnScroll
          >
            <Background color="#1e293b" gap={20} size={1} />
            <Controls
              showInteractive={false}
              position="bottom-right"
              className="!bg-slate-900 !border-slate-700 !shadow-lg [&>button]:!bg-slate-800 [&>button]:!border-slate-700 [&>button]:!text-slate-300 [&>button:hover]:!bg-slate-700"
            />
          </ReactFlow>
        </div>

        {/* Accessible semantic fallback */}
        <TopologyFallback
          analysis={analysis}
          consumers={consumers}
          onSelectConsumer={onSelectConsumer}
        />
      </CardContent>
    </Card>
  )
}
