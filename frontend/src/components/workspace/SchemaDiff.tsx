/**
 * SchemaDiff — PR-style visual diff of schema changes between contract versions.
 * Shows added fields (+), removed fields (-), type changes (→), and requiredness changes.
 */

import type { ChangeSet, ConsumerFinding } from '@/types/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import { GitPullRequest } from 'lucide-react'

interface SchemaDiffProps {
  changeSet: ChangeSet
  findings?: ConsumerFinding[]
  selectedField?: string | null
  onSelectField?: (field: string | null) => void
}

export function SchemaDiff({
  changeSet,
  findings = [],
  selectedField = null,
  onSelectField,
}: SchemaDiffProps) {
  const { addedFields, removedFields, typeChanges, requirednessChanges } = changeSet

  const hasChanges =
    addedFields.length > 0 ||
    removedFields.length > 0 ||
    typeChanges.length > 0 ||
    requirednessChanges.length > 0

  if (!hasChanges) {
    return (
      <Card className="border-slate-800 bg-[#0c1220]/80">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <GitPullRequest className="h-3.5 w-3.5 text-blue-400" />
            <span>Schema Diff</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <p className="text-xs text-slate-500 font-mono text-center py-3">
            No schema changes detected between versions.
          </p>
        </CardContent>
      </Card>
    )
  }

  const handleFieldClick = (field: string) => {
    if (!onSelectField) return
    onSelectField(selectedField === field ? null : field)
  }

  const getFindingForField = (field: string) => {
    return findings.find((f) => f.field === field)
  }

  return (
    <Card className="border-slate-800 bg-[#0c1220]/80">
      <CardHeader className="py-3 px-4 border-b border-slate-800/80">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xs font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
            <GitPullRequest className="h-3.5 w-3.5 text-blue-400" />
            <span>Schema Diff</span>
          </CardTitle>
          <div className="flex items-center space-x-2 text-[10px] font-mono text-slate-500 uppercase">
            {addedFields.length > 0 && (
              <span className="text-emerald-400">+{addedFields.length} ADDED</span>
            )}
            {removedFields.length > 0 && (
              <span className="text-rose-400">−{removedFields.length} REMOVED</span>
            )}
            {typeChanges.length > 0 && (
              <span className="text-amber-400">{typeChanges.length} TYPE CHANGE{typeChanges.length !== 1 ? 'S' : ''}</span>
            )}
            {requirednessChanges.length > 0 && (
              <span className="text-blue-400">{requirednessChanges.length} REQUIREDNESS CHANGE{requirednessChanges.length !== 1 ? 'S' : ''}</span>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        <div className="divide-y divide-slate-800/60 font-mono text-xs">
          {/* Added fields */}
          {addedFields.map((field) => {
            const finding = getFindingForField(field)
            return (
              <button
                key={`add-${field}`}
                type="button"
                onClick={() => handleFieldClick(field)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between space-x-3 transition-colors cursor-pointer ${
                  selectedField === field
                    ? 'bg-emerald-950/30 ring-1 ring-inset ring-emerald-500/40'
                    : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-emerald-400 font-bold w-4 text-center flex-shrink-0">+</span>
                  <span className="text-emerald-300 font-medium">{field}</span>
                  <span className="text-slate-500 text-[10px] uppercase font-bold tracking-wider">ADDED</span>
                </div>
                {finding && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-500/30 bg-emerald-950/40 text-emerald-300">
                    impacts {finding.consumerId}
                  </span>
                )}
              </button>
            )
          })}

          {/* Removed fields */}
          {removedFields.map((field) => {
            const finding = getFindingForField(field)
            return (
              <button
                key={`rem-${field}`}
                type="button"
                onClick={() => handleFieldClick(field)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between space-x-3 transition-colors cursor-pointer ${
                  selectedField === field
                    ? 'bg-rose-950/30 ring-1 ring-inset ring-rose-500/40'
                    : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-rose-400 font-bold w-4 text-center flex-shrink-0">−</span>
                  <span className="text-rose-300 font-medium line-through decoration-rose-500/50">{field}</span>
                  <span className="text-rose-400 text-[10px] uppercase font-bold tracking-wider bg-rose-950/40 px-1 rounded border border-rose-500/30">REMOVED</span>
                </div>
                {finding && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-500/40 bg-amber-950/60 text-amber-300 font-semibold">
                    impacts {finding.consumerId} ({finding.status})
                  </span>
                )}
              </button>
            )
          })}

          {/* Type changes */}
          {typeChanges.map((tc) => {
            const finding = getFindingForField(tc.field)
            return (
              <button
                key={`type-${tc.field}`}
                type="button"
                onClick={() => handleFieldClick(tc.field)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between space-x-3 transition-colors cursor-pointer ${
                  selectedField === tc.field
                    ? 'bg-amber-950/30 ring-1 ring-inset ring-amber-500/40'
                    : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-amber-400 font-bold w-4 text-center flex-shrink-0">~</span>
                  <span className="text-amber-300 font-medium">{tc.field}</span>
                  <span className="text-amber-400 text-[10px] uppercase font-bold tracking-wider bg-amber-950/40 px-1 rounded border border-amber-500/30">TYPE CHANGE</span>
                  <span className="text-slate-400 text-[10px]">
                    <span className="text-rose-400 font-bold">{tc.fromType}</span>
                    <span className="text-slate-600 mx-1">→</span>
                    <span className="text-emerald-400 font-bold">{tc.toType}</span>
                  </span>
                </div>
                {finding && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-rose-500/40 bg-rose-950/60 text-rose-300 font-semibold">
                    impacts {finding.consumerId} ({finding.status})
                  </span>
                )}
              </button>
            )
          })}

          {/* Requiredness changes */}
          {requirednessChanges.map((rc) => {
            const finding = getFindingForField(rc.field)
            return (
              <button
                key={`req-${rc.field}`}
                type="button"
                onClick={() => handleFieldClick(rc.field)}
                className={`w-full text-left px-4 py-2.5 flex items-center justify-between space-x-3 transition-colors cursor-pointer ${
                  selectedField === rc.field
                    ? 'bg-blue-950/30 ring-1 ring-inset ring-blue-500/40'
                    : 'hover:bg-slate-900/60'
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-blue-400 font-bold w-4 text-center flex-shrink-0">⇄</span>
                  <span className="text-blue-300 font-medium">{rc.field}</span>
                  <span className="text-blue-400 text-[10px] uppercase font-bold tracking-wider bg-blue-950/40 px-1 rounded border border-blue-500/30">REQUIREDNESS CHANGE</span>
                  <span className="text-slate-400 text-[10px]">
                    <span className={rc.fromRequired ? 'text-amber-400' : 'text-slate-500'}>
                      {rc.fromRequired ? 'required' : 'optional'}
                    </span>
                    <span className="text-slate-600 mx-1">→</span>
                    <span className={rc.toRequired ? 'text-amber-400' : 'text-slate-500'}>
                      {rc.toRequired ? 'required' : 'optional'}
                    </span>
                  </span>
                </div>
                {finding && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded border border-blue-500/40 bg-blue-950/60 text-blue-300">
                    impacts {finding.consumerId}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
