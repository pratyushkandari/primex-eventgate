/**
 * Producer → EventGate → consumers graph drawn with @xyflow/react. Loaded
 * lazily because xyflow is the largest dependency in the bundle.
 */
import { useMemo } from 'react'
import { Background, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardHeader } from '@/components/ui/Card'
import { StatusBadge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import type { ConsumerImpact } from '@/lib/findings'
import type { Decision } from '@/types/api'
import { TopologyFallback } from './TopologyFallback'

interface DependencyTopologyProps {
  eventType: string
  currentVersion: number
  proposedVersion: number
  decision: Decision | null
  impacts: ConsumerImpact[]
  hasAnalysis: boolean
  selectedConsumerId: string | null
  onSelectConsumer: (consumerId: string) => void
}

const COLORS = {
  ALLOW: '#3ccf91',
  SAFE: '#3ccf91',
  REVIEW: '#f5b544',
  RISK: '#f5b544',
  BLOCK: '#f77b7b',
  BREAK: '#f77b7b',
  idle: '#34425a',
}

const NODE_BOX = 'rounded-md border bg-surface px-3 py-2 text-left shadow-sm'

function ProducerNode({ data }: NodeProps) {
  return (
    <div className={cn(NODE_BOX, 'border-line')}>
      <p className="text-xs text-fg-subtle">Producer</p>
      <p className="text-sm font-medium text-fg">{data.label as string}</p>
      <Handle type="source" position={Position.Right} className="!bg-line-strong" />
    </div>
  )
}

function GateNode({ data }: NodeProps) {
  const decision = data.decision as Decision | null
  return (
    <div className={cn(NODE_BOX, 'border-line-strong')}>
      <Handle type="target" position={Position.Left} className="!bg-line-strong" />
      <p className="text-xs text-fg-subtle">EventGate</p>
      <div className="mt-0.5">{decision ? <StatusBadge value={decision} /> : <span className="text-sm text-fg-muted">Not analyzed</span>}</div>
      <Handle type="source" position={Position.Right} className="!bg-line-strong" />
    </div>
  )
}

function ConsumerNode({ data }: NodeProps) {
  const impact = data.impact as ConsumerImpact
  const finding = impact.findings.find((f) => f.status !== 'SAFE')
  return (
    <div
      className={cn(
        NODE_BOX,
        'w-56 cursor-pointer',
        data.selected ? 'border-accent' : 'border-line hover:border-line-strong',
        data.muted ? 'border-dashed' : ''
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-line-strong" />
      <div className="flex items-center justify-between gap-2">
        <span className="truncate font-mono text-xs text-fg">{impact.consumerId}</span>
        {Boolean(data.hasAnalysis) && <StatusBadge value={impact.status} />}
      </div>
      {finding && finding.field !== '*' && (
        <p className="mt-1 truncate text-xs text-fg-subtle">
          {finding.field}
          {finding.expectedType && finding.proposedType ? `: ${finding.expectedType} → ${finding.proposedType}` : ''}
        </p>
      )}
    </div>
  )
}

const nodeTypes = { producer: ProducerNode, gate: GateNode, consumer: ConsumerNode }
const ROW_GAP = 84

export function DependencyTopology({
  eventType,
  currentVersion,
  proposedVersion,
  decision,
  impacts,
  hasAnalysis,
  selectedConsumerId,
  onSelectConsumer,
}: DependencyTopologyProps) {
  const label = `${eventType} v${currentVersion} → v${proposedVersion}`
  const middle = ((impacts.length - 1) * ROW_GAP) / 2

  const nodes = useMemo<Node[]>(() => {
    const anyAffected = impacts.some((i) => i.status !== 'SAFE')
    return [
      { id: 'producer', type: 'producer', position: { x: 0, y: middle }, data: { label } },
      { id: 'gate', type: 'gate', position: { x: 260, y: middle - 4 }, data: { decision } },
      ...impacts.map<Node>((impact, i) => ({
        id: impact.consumerId,
        type: 'consumer',
        position: { x: 470, y: i * ROW_GAP },
        data: {
          impact,
          hasAnalysis,
          selected: selectedConsumerId === impact.consumerId,
          muted: selectedConsumerId
            ? selectedConsumerId !== impact.consumerId
            : hasAnalysis && anyAffected && impact.status === 'SAFE',
        },
      })),
    ]
  }, [impacts, label, decision, hasAnalysis, selectedConsumerId, middle])

  const edges = useMemo<Edge[]>(() => {
    const stopped = decision === 'BLOCK' || decision === 'REVIEW'
    return [
      {
        id: 'producer-gate',
        source: 'producer',
        target: 'gate',
        style: { stroke: decision ? COLORS[decision] : COLORS.idle, strokeWidth: 2 },
      },
      ...impacts.map<Edge>((impact) => ({
        id: `gate-${impact.consumerId}`,
        source: 'gate',
        target: impact.consumerId,
        style: {
          stroke: hasAnalysis ? COLORS[impact.status] : COLORS.idle,
          strokeWidth: impact.status === 'SAFE' ? 1.5 : 2,
          strokeDasharray: stopped ? '6 4' : undefined,
        },
      })),
    ]
  }, [impacts, decision, hasAnalysis])

  const height = Math.max(200, impacts.length * ROW_GAP + 60)

  return (
    <Card>
      <CardHeader
        title="Dependency graph"
        description={
          decision === 'BLOCK' || decision === 'REVIEW'
            ? 'Dashed edges: the event stops at the gate and no consumer receives it.'
            : 'Click a consumer to inspect it.'
        }
      />
      <div style={{ height }} className="w-full" aria-hidden="true">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={(_, node) => node.type === 'consumer' && onSelectConsumer(node.id)}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          nodesFocusable={false}
          edgesFocusable={false}
          zoomOnScroll={false}
          preventScrolling={false}
          minZoom={0.4}
          maxZoom={1}
        >
          <Background color="#243044" gap={24} size={1} />
        </ReactFlow>
      </div>
      <TopologyFallback eventLabel={label} decision={decision} impacts={impacts} hasAnalysis={hasAnalysis} />
    </Card>
  )
}
