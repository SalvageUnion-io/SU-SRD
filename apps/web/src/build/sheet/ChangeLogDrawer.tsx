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

import type { ChangeLogKind } from 'cantina-domain/schemas/changeLog'
import type { EntityRef } from 'cantina-domain/schemas/entity'
import { useQuery } from 'convex/react'
import type { CSSProperties } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import type { BadgeTone } from '../index'
import {
  Badge,
  EmptyState,
  FeedLine,
  FeedList,
  FeedTime,
  ModalShell,
  Pending,
  tokens,
} from '../index'

type ChangeLogDrawerProps = {
  entityType: EntityRef['type']
  entityId: string
  entityName: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Kind → human label + its chip: a tone chip for the two kinds a rule wrote, quiet for a hand edit. */
const KIND_META: Record<ChangeLogKind, { label: string; tone?: BadgeTone }> = {
  transaction: { label: 'Transaction', tone: 'mech' },
  override: { label: 'Override', tone: 'pilot' },
  manual: { label: 'Manual' },
}

/** A kind's chip: the Badge chip, toned or quiet. */
function KindChip({ label, tone }: { label: string; tone?: BadgeTone | undefined }) {
  return tone ? (
    <Badge surface="tone" tone={tone}>
      {label}
    </Badge>
  ) : (
    <Badge surface="quiet">{label}</Badge>
  )
}

const NOTE = {
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.sm,
  lineHeight: 'calc(1.25 / 0.875)',
  color: tokens.color.wkMuted,
} satisfies CSSProperties

/** The time keeps to the head line's far end. */
const PUSH = { marginLeft: 'auto' } satisfies CSSProperties

const MUTED = { color: tokens.color.wkMuted } satisfies CSSProperties

const BEFORE = { ...MUTED, textDecorationLine: 'line-through' } satisfies CSSProperties

const AFTER = { fontWeight: tokens.weight.medium, color: tokens.color.ink } satisfies CSSProperties

/** The drawer body's fill; its padding steps up at `sm` (`.su-sheet-changelog-body`). */
const BODY = { backgroundColor: tokens.color.paper } satisfies CSSProperties

/** Compact display for a logged before/after value. An absent side is stored as null. */
function formatValue(value: unknown): string {
  if (value === undefined || value === null) return '—'
  if (typeof value === 'string') return value.length === 0 ? '""' : value
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  const json = JSON.stringify(value)
  return json.length > 80 ? `${json.slice(0, 79)}…` : json
}

function ChangeLogEntries({
  entityType,
  entityId,
}: Pick<ChangeLogDrawerProps, 'entityType' | 'entityId'>) {
  const entries = useQuery(api.changeLog.forEntity, { entityType, entityId })

  if (entries === undefined) return <Pending />
  if (entries.length === 0) {
    return (
      <EmptyState
        variant="quiet"
        body={`No changes recorded yet. Edits to this ${entityType} will appear here.`}
      />
    )
  }
  return (
    <FeedList>
      {entries.map((entry) => {
        const kind = KIND_META[entry.kind]
        return (
          <FeedLine
            key={entry._id}
            head={
              <>
                <KindChip label={kind.label} tone={kind.tone} />
                {entry.state === 'proposed' && <KindChip label="Proposed" />}
                <span>{entry.field}</span>
                <span style={PUSH}>
                  <FeedTime ts={entry.ts} format="datetime" />
                </span>
              </>
            }
          >
            <span style={BEFORE}>{formatValue(entry.before)}</span>{' '}
            <span aria-hidden="true" style={MUTED}>
              →
            </span>{' '}
            <span style={AFTER}>{formatValue(entry.after)}</span>
          </FeedLine>
        )
      })}
    </FeedList>
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
      maxWidth="su-sheet-changelog-dialog"
      description={`Change history for ${entityName}`}
    >
      <div className="su-sheet-changelog-body" style={BODY}>
        {live ? (
          <ChangeLogEntries entityType={entityType} entityId={entityId} />
        ) : (
          <p style={NOTE}>
            The Change Log is kept with your account. It shows here while you are connected.
          </p>
        )}
      </div>
    </ModalShell>
  )
}
