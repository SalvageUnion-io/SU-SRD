/**
 * ChangeLogDrawer — the per-entity Change Log (provenance), shown behind the
 * sheet's overflow menu, never inline in the sheet body (ADR-021 / ADR-022).
 *
 * The Live Sheet is the Free-Edit surface: it shows current state, and the full
 * history of _how_ that state got there lives one tap away. Entries are the
 * server's (`changeLog.forEntity`), newest first: edits from every device,
 * ownership changes, and the Mediator's proposals, applied or still pending.
 * The log itself is never mutated from the UI: a change's button (every
 * line's) is a new write that reverses that one change on the sheet as it is
 * now (r3 B1). The log reads as the sheet's story (r6 E14, `logStory`): a
 * change taken back leaves it and a redo puts it back, and quick taps on one
 * value read as one line.
 */

import type { ChangeLogKind } from 'game-domain/schemas/changeLog'
import type { EntityRef } from 'game-domain/schemas/entity'
import { ArrowRight } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef } from 'react'
import { FeedLine, FeedList, FeedTime } from '../../components/app'
import type { BadgeTone } from '../../components/index'
import {
  Badge,
  Button,
  EmptyState,
  Eyebrow,
  ModalShell,
  Pending,
  Text,
  tokens,
} from '../../components/index'
import { buildSheetCopy } from '../../messages/build-sheet'
import { useSync } from '../../replica/syncContext'
import { useEntityLog } from '../../replica/useEntityLog'
import type { LogChange, LogDefaults, LogLine, Reversal } from './changeLog.model'
import {
  lineText,
  logChanges,
  logStory,
  reversal,
  reversible,
  splitJustNow,
} from './changeLog.model'

type ChangeLogDrawerProps = {
  entityType: EntityRef['type']
  entityId: string
  entityName: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /**
   * Reverse one change, and only it: every line offers it, in the words of
   * what it does. Absent where the viewer may not write.
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
  if (!change.from) return change.did ? buildSheetCopy('logForDid', { did: change.did }) : undefined
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

/** The log's two runs ("Just now", then what the dialog opened with), and each run. */
const RUNS = { display: 'grid', gap: tokens.space[16] } satisfies CSSProperties
const RUN = { display: 'grid', gap: tokens.space[8] } satisfies CSSProperties

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

/** The nearest ancestor that scrolls: the dialog's body. */
function scrollerOf(el: HTMLElement): HTMLElement | null {
  for (let at = el.parentElement; at; at = at.parentElement) {
    const { overflowY } = getComputedStyle(at)
    if (overflowY === 'auto' || overflowY === 'scroll') return at
  }
  return null
}

function ChangeLogEntries({
  entityType,
  entityId,
  onRestore,
  defaults,
}: Pick<ChangeLogDrawerProps, 'entityType' | 'entityId' | 'onRestore' | 'defaults'>) {
  const entries = useEntityLog(entityType, entityId)
  // What the log held when the dialog opened: later changes go above it, under
  // "Just now", and these keep their place (r4 E2).
  const seen = useRef<ReadonlySet<string> | null>(null)
  const earlierRef = useRef<HTMLDivElement>(null)
  const earlierTop = useRef<number | null>(null)
  // A line that arrives above pushes the rest down: the dialog scrolls by as
  // much, so the line under the pointer is still the one under it.
  useLayoutEffect(() => {
    const el = earlierRef.current
    if (!el) return
    const top = el.offsetTop
    const was = earlierTop.current
    earlierTop.current = top
    if (was === null || top === was) return
    const scroller = scrollerOf(el)
    if (scroller) scroller.scrollTop += top - was
  })

  if (entries === undefined) return <Pending />
  if (entries.length === 0) {
    return (
      <EmptyState
        variant="quiet"
        body={buildSheetCopy('noChangesRecordedYetEdits', { entityType })}
      />
    )
  }
  // The story, not the tap stream (r6 E14): undone changes leave it, runs merge.
  const changes = logStory(logChanges(entries, defaults))
  seen.current ??= new Set(changes.map((change) => change.id))
  const { justNow, earlier } = splitJustNow(changes, seen.current)
  const line = (change: LogChange) => {
    const kind = KIND_META[change.kind]
    const from = origin(change)
    const did = reversal(change, defaults)
    const named = change.lines.map(lineText).join(', ')
    return (
      <FeedLine
        key={change.id}
        head={
          <>
            {kind && <KindChip label={kind.label} tone={kind.tone} />}
            {from && <span style={MUTED}>{from}</span>}
            {change.state === 'proposed' && <KindChip label={buildSheetCopy('proposed')} />}
            <span style={PUSH}>
              <FeedTime ts={change.ts} format="seconds" />
            </span>
          </>
        }
        end={
          // Every line offers its way back (r6 E14); a change taken back has
          // left the story, so a second press can never put a second copy on.
          onRestore && reversible(change) ? (
            <Button
              size="compact"
              // Each button names its own change: ten "Put back" read apart.
              aria-label={buildSheetCopy('logReverseNamed', { action: did.label, change: named })}
              onClick={() => onRestore(change, did)}
            >
              {did.label}
            </Button>
          ) : undefined
        }
      >
        <span style={LINES}>
          {change.lines.map((each) => (
            <Line key={each.key} line={each} />
          ))}
        </span>
      </FeedLine>
    )
  }
  return (
    <div style={RUNS}>
      {justNow.length > 0 && (
        <section aria-label={buildSheetCopy('logJustNow')} style={RUN}>
          <Eyebrow as="div" tone="muted">
            {buildSheetCopy('logJustNow')}
          </Eyebrow>
          <FeedList>{justNow.map(line)}</FeedList>
        </section>
      )}
      <div ref={earlierRef} style={RUN}>
        {justNow.length > 0 && earlier.length > 0 && (
          <Eyebrow as="div" tone="muted">
            {buildSheetCopy('logEarlier')}
          </Eyebrow>
        )}
        <FeedList>{earlier.map(line)}</FeedList>
      </div>
    </div>
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
