/**
 * ChangeLogDrawer — the per-entity Change Log (provenance), shown behind the
 * sheet's overflow menu, never inline in the sheet body (ADR-021 / ADR-022).
 *
 * The Live Sheet is the Free-Edit surface: it shows current state, and the full
 * history of _how_ that state got there lives one tap away. Entries are the
 * server's (`changeLog.forEntity`), newest first: edits from every device,
 * ownership changes, and the Mediator's proposals, applied or still pending.
 * The log itself is never mutated from the UI: a change's button (the newest
 * ten changes) is a new write that reverses that one change on the sheet as
 * it is now, and is logged as one (r3 B1).
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
import type { LogChange, LogDefaults, LogLine, Reversal } from './changeLog.model'
import { lineText, logChanges, reversal } from './changeLog.model'

type ChangeLogDrawerProps = {
  entityType: EntityRef['type']
  entityId: string
  entityName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Reverse one change, and only it: each of the newest ten changes offers
   * it, in the words of what it does. Absent where the viewer may not write.
   */
  onRestore?: ((change: LogChange, did: Reversal) => void) | undefined
  /** What an absent value stood for, by field: a full pool, an empty tally. */
  defaults?: LogDefaults | undefined
}

/**
 * Kind → its chip, for a cap somebody pinned. A hand edit is the log's plain
 * case and wears none, and a rule's write says where it came from in words
 * (`origin`), never the store's name for it (r3 B4).
 */
const KIND_META: Partial<Record<ChangeLogKind, { label: string; tone: BadgeTone }>> = {
  override: { label: buildSheetCopy('override'), tone: 'pilot' },
}

/** "From Play · Squeeze It In": where a rule's write came from, and what for. */
function origin(change: LogChange): string | undefined {
  if (!change.from) return undefined
  const from = buildSheetCopy(change.from === 'play' ? 'logFromPlay' : 'logFromDowntime')
  return change.did ? buildSheetCopy('logFromDid', { from, did: change.did }) : from
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

/**
 * The change's arrow, muted and centred on the values: inline, so the old
 * value, the arrow and the new value read on one line (r3 B4).
 */
const GLYPH = { ...MUTED, display: 'inline-block', verticalAlign: 'middle' } satisfies CSSProperties

const BEFORE = { ...MUTED, textDecorationLine: 'line-through' } satisfies CSSProperties

const AFTER = { fontWeight: tokens.weight.medium, color: tokens.color.ink } satisfies CSSProperties

/** The drawer body's fill; its padding steps up at `sm` (`.su-sheet-changelog-body`). */
const BODY = { backgroundColor: tokens.color.paper } satisfies CSSProperties

/** How many of the newest changes offer Restore. */
const RESTORABLE = 10

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
  defaults,
}: Pick<ChangeLogDrawerProps, 'entityType' | 'entityId' | 'onRestore' | 'defaults'>) {
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
      {logChanges(entries, defaults).map((change, i) => {
        const kind = KIND_META[change.kind]
        const from = origin(change)
        const did = reversal(change, defaults)
        return (
          <FeedLine
            key={change.id}
            head={
              <>
                {kind && <KindChip label={kind.label} tone={kind.tone} />}
                {from && <span style={MUTED}>{from}</span>}
                {change.state === 'proposed' && <KindChip label={buildSheetCopy('proposed')} />}
                <span style={PUSH}>
                  <FeedTime ts={change.ts} format="datetime" />
                </span>
              </>
            }
            end={
              onRestore && i < RESTORABLE && change.state === 'applied' ? (
                <Button
                  size="compact"
                  // Each button names its own change: ten "Put back" read apart.
                  aria-label={buildSheetCopy('logReverseNamed', {
                    action: did.label,
                    change: change.lines.map(lineText).join(', '),
                  })}
                  onClick={() => onRestore(change, did)}
                >
                  {did.label}
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
  defaults,
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
          <ChangeLogEntries
            entityType={entityType}
            entityId={entityId}
            onRestore={onRestore}
            defaults={defaults}
          />
        ) : (
          <Text variant="note">{buildSheetCopy('theChangeLogIsKept')}</Text>
        )}
      </div>
    </ModalShell>
  )
}
