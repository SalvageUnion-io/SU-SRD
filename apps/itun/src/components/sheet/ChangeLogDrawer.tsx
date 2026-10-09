/**
 * ChangeLogDrawer — the per-entity Change Log (provenance), shown behind the
 * sheet's overflow menu, never inline in the sheet body (ADR-021 / ADR-022).
 *
 * The Live Sheet is the Free-Edit surface: it shows current state, and the full
 * history of _how_ that state got there lives one tap away. Entries are the
 * server's (`changeLog.forEntity`), newest first: edits from every device,
 * ownership changes, and the Mediator's proposals, applied or still pending.
 * This is read-only — the log is never mutated from the UI.
 */

import { ModalShell } from 'component-lib'
import { useQuery } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import type { ChangeLogKind } from '../../lib/schemas/changeLog'
import type { EntityRef } from '../../lib/schemas/entity'

type ChangeLogDrawerProps = {
  entityType: EntityRef['type']
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

const BADGE_CLASS =
  'rounded-card px-1.5 py-0.5 font-cond text-badge font-bold uppercase tracking-caps-tight'

const NOTE_CLASS = 'font-body text-sm text-wk-muted'

/** Compact display for a logged before/after value. An absent side is stored as null. */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
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

function ChangeLogEntries({
  entityType,
  entityId,
}: Pick<ChangeLogDrawerProps, 'entityType' | 'entityId'>) {
  const entries = useQuery(api.changeLog.forEntity, { entityType, entityId })

  if (entries === undefined) return <p className={NOTE_CLASS}>Loading…</p>
  if (entries.length === 0) {
    return (
      <p className={NOTE_CLASS}>
        No changes recorded yet. Edits to this {entityType} will appear here.
      </p>
    )
  }
  return (
    <ul className="flex flex-col gap-2">
      {entries.map((entry) => {
        const kind = KIND_META[entry.kind]
        return (
          <li
            key={entry._id}
            className="flex flex-col gap-1 rounded-card border border-ink/15 bg-ink/[0.03] px-3 py-2"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className={`${BADGE_CLASS} ${kind.className}`}>{kind.label}</span>
              {entry.state === 'proposed' && (
                <span className={`${BADGE_CLASS} ${KIND_META.manual.className}`}>Proposed</span>
              )}
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
  )
}

export function ChangeLogDrawer({
  entityType,
  entityId,
  entityName,
  open,
  onOpenChange,
}: ChangeLogDrawerProps) {
  const { mode } = useConnection()
  // Whether the entries MOUNT: they read Convex, so they render only on a live
  // connection — as the Share dialog's live panel does.
  const live = mode === 'connected'

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
        {live ? (
          <ChangeLogEntries entityType={entityType} entityId={entityId} />
        ) : (
          <p className={NOTE_CLASS}>
            The Change Log is kept with your account. It shows here while you are connected.
          </p>
        )}
      </div>
    </ModalShell>
  )
}
