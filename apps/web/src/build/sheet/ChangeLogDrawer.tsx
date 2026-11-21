/**
 * ChangeLogDrawer — the per-entity Change Log (provenance), shown behind the
 * sheet's overflow menu, never inline in the sheet body (ADR-021 / ADR-022).
 *
 * The Live Sheet is the Free-Edit surface: it shows current state, and the full
 * history of _how_ that state got there lives one tap away. Entries are the
 * server's (`changeLog.forEntity`), newest first: edits from every device,
 * ownership changes, and the Mediator's proposals, applied or still pending.
 * The log itself is never mutated from the UI: Restore (the newest ten changes)
 * is a new write that puts a change's fields back, and is logged as one.
 */

import type { ChangeLogKind } from 'game-domain/schemas/changeLog'
import type { EntityRef } from 'game-domain/schemas/entity'
import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { FeedLine, FeedList, FeedTime } from '../../components/app'
import type { BadgeTone } from '../../components/index'
import {
  Badge,
  Button,
  EmptyState,
  ModalShell,
  Pending,
  Text,
  tokens,
} from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import { useSync } from '../../replica/syncContext'
import { useEntityLog } from '../../replica/useEntityLog'
import type { LogLine } from './changeLog.model'
import { logChanges, RESTORABLE } from './changeLog.model'

type ChangeLogDrawerProps = {
  entityType: EntityRef['type']
  entityId: string
  entityName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Put a change's fields back as they were: each of the newest ten changes
   * offers it. Absent where the viewer may not write.
   */
  onRestore?: ((before: Record<string, unknown>) => void) | undefined
}

/**
 * Kind → its chip, for the two kinds a rule wrote. A hand edit is the log's
 * plain case and wears none.
 */
const KIND_META: Partial<Record<ChangeLogKind, { label: string; tone: BadgeTone }>> = {
  transaction: { label: buildSheetCopy('transaction'), tone: 'mech' },
  override: { label: buildSheetCopy('override'), tone: 'pilot' },
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

/** The time keeps to the head line's far end. */
const PUSH = { marginLeft: 'auto' } satisfies CSSProperties

const MUTED = { color: tokens.color.wkMuted } satisfies CSSProperties

/** The change's arrow, muted and centred on the values. */
const GLYPH = { ...MUTED, verticalAlign: 'middle' } satisfies CSSProperties

const BEFORE = { ...MUTED, textDecorationLine: 'line-through' } satisfies CSSProperties

const AFTER = { fontWeight: tokens.weight.medium, color: tokens.color.ink } satisfies CSSProperties

/** The drawer body's fill; its padding steps up at `sm` (`.su-sheet-changelog-body`). */
const BODY = { backgroundColor: tokens.color.paper } satisfies CSSProperties

/** A change's lines stack, each whole. */
const LINES = { display: 'grid', gap: tokens.space[4] } satisfies CSSProperties

function Line({ line }: { line: LogLine }) {
  if ('text' in line) return <span>{line.text}</span>
  return (
    <span>
      {line.label}: <span style={BEFORE}>{line.before}</span>{' '}
      {/* The value's change, a glyph at the line's Size (K11), never a text arrow. */}
      <ArrowRight
        size={tokens.iconSize.compact}
        aria-label={buildSheetCopy('logTo')}
        style={GLYPH}
      />{' '}
      <span style={AFTER}>{line.after}</span>
    </span>
  )
}

function ChangeLogEntries({
  entityType,
  entityId,
  onRestore,
}: Pick<ChangeLogDrawerProps, 'entityType' | 'entityId' | 'onRestore'>) {
  const entries = useEntityLog(entityType, entityId)

  if (entries === undefined) return <Pending />
  if (entries.length === 0) {
    return (
      <EmptyState
        variant="quiet"
        body={buildSheetCopy('noChangesRecordedYetEdits', { entityType })}
      />
    )
  }
  return (
    <FeedList>
      {logChanges(entries).map((change, i) => {
        const kind = KIND_META[change.kind]
        return (
          <FeedLine
            key={change.id}
            head={
              <>
                {kind && <KindChip label={kind.label} tone={kind.tone} />}
                {change.state === 'proposed' && <KindChip label={buildSheetCopy('proposed')} />}
                <span style={PUSH}>
                  <FeedTime ts={change.ts} format="datetime" />
                </span>
              </>
            }
            end={
              onRestore && i < RESTORABLE && change.state === 'applied' ? (
                <Button size="compact" onClick={() => onRestore(change.before)}>
                  {buildSheetCopy('restore')}
                </Button>
              ) : undefined
            }
          >
            <span style={LINES}>
              {change.lines.map((line) => (
                <Line key={line.key} line={line} />
              ))}
            </span>
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
  onRestore,
}: ChangeLogDrawerProps) {
  const { status } = useSync()
  // Whether the entries MOUNT: they read the unit's room, so they render only on a live connection, as the Share dialog's
  // live panel does.
  const live = status === 'live'

  return (
    <ModalShell
      open={open}
      onOpenChange={onOpenChange}
      title={buildSheetCopy('changeLog')}
      subtitle={entityName}
      tone="danger"
      width="default"
      description={buildSheetCopy('changeHistoryFor', { entityName })}
    >
      <div className="su-sheet-changelog-body" style={BODY}>
        {live ? (
          <ChangeLogEntries entityType={entityType} entityId={entityId} onRestore={onRestore} />
        ) : (
          <Text variant="note">{buildSheetCopy('theChangeLogIsKept')}</Text>
        )}
      </div>
    </ModalShell>
  )
}
