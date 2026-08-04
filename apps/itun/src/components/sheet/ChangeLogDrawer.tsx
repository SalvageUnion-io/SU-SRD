/**
 * ChangeLogDrawer — the per-entity Change Log (provenance), shown behind the
 * sheet's overflow menu, never inline in the sheet body (ADR-021 / ADR-022).
 *
 * The Live Sheet is the Free-Edit surface: it shows current state, and the full
 * history of _how_ that state got there lives one tap away. Entries are read
 * on open from the local, append-only `db.changeLog` store (newest first). This
 * is read-only — the log is never mutated from the UI.
 */

import { ModalShell } from 'component-lib'
import { useEffect, useState } from 'react'
import { changeLog } from '../../lib/db/index'
import type { ChangeLogEntry, ChangeLogKind } from '../../lib/schemas/changeLog'
import type { EntityType } from '../../stores/entityStore'

type ChangeLogDrawerProps = {
  entityType: EntityType
  entityId: string
  entityName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Kind → human label + badge tone. */
const KIND_META: Record<ChangeLogKind, { label: string; className: string }> = {
  transaction: { label: 'Transaction', className: 'bg-mech/15 text-mech' },
  override: { label: 'Override', className: 'bg-pilot/15 text-pilot' },
  manual: { label: 'Manual', className: 'bg-ink/10 text-wk-muted' },
}

/** Compact display for a logged before/after value. */
function formatValue(value: unknown): string {
  if (value === undefined) return '—'
  if (value === null) return 'null'
  if (typeof value === 'string') return value.length === 0 ? '""' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const json = JSON.stringify(value)
  return json.length > 80 ? `${json.slice(0, 79)}…` : json
}

function formatTimestamp(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function ChangeLogDrawer({
  entityType,
  entityId,
  entityName,
  open,
  onOpenChange,
}: ChangeLogDrawerProps) {
  const [entries, setEntries] = useState<ChangeLogEntry[] | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setEntries(null)
    void changeLog.listForEntity(entityId).then((rows) => {
      if (!cancelled) setEntries(rows)
    })
    return () => {
      cancelled = true
    }
  }, [open, entityId])

  // Newest first — listForEntity returns oldest→newest by seq.
  const ordered = entries ? [...entries].reverse() : null

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title="Change Log"
      subtitle={entityName}
      tone="danger"
      maxWidth="max-w-2xl"
      description={`Change history for ${entityName}`}
    >
      <div className="bg-paper p-4 sm:p-5">
        {ordered === null ? (
          <p className="font-body text-sm text-wk-muted">Loading…</p>
        ) : ordered.length === 0 ? (
          <p className="font-body text-sm text-wk-muted">
            No changes recorded yet. Edits to this {entityType} will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {ordered.map((entry) => {
              const kind = KIND_META[entry.kind]
              return (
                <li
                  key={entry.seq}
                  className="flex flex-col gap-1 rounded-[4px] border border-ink/15 bg-ink/[0.03] px-3 py-2"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-[3px] px-1.5 py-0.5 font-cond text-badge font-bold uppercase tracking-caps-tight ${kind.className}`}
                    >
                      {kind.label}
                    </span>
                    <span className="font-cond text-sm font-bold uppercase tracking-caps-tight text-ink">
                      {entry.field}
                    </span>
                    <time
                      dateTime={new Date(entry.ts).toISOString()}
                      className="ml-auto font-body text-xs text-wk-muted"
                    >
                      {formatTimestamp(entry.ts)}
                    </time>
                  </div>
                  <div className="flex flex-wrap items-baseline gap-1.5 font-body text-sm">
                    <span className="text-wk-muted line-through">{formatValue(entry.before)}</span>
                    <span aria-hidden="true" className="text-wk-muted">
                      →
                    </span>
                    <span className="font-medium text-ink">{formatValue(entry.after)}</span>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </ModalShell>
  )
}
