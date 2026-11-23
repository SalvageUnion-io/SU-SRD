import { PreviewCard } from '@base-ui/react/preview-card'
import type { CSSProperties, ErrorInfo, ReactNode } from 'react'
import { Component, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type { EntitySchemaName, RefEntity, RefObjectTable } from 'salvageunion-reference'
import {
  EntitySchemaNames,
  nestedEntityGroups,
  resolveTable,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { borderWidth, color, layer, space, widthAtLeast } from '../../design/tokens'
import { captureException } from '../../lib/observability'
import { entityCopy } from '../../messages/components-entity'
import { CloseButton } from '../atoms/CloseButton'
import { InlineRef } from '../atoms/InlineRef'
import { EmptyState } from '../containers/EmptyState'
import { Skeleton } from '../containers/Skeleton'
import type { Down } from '../referenceEntity/card/cardChrome'
import { useEntitySurface } from './entitySurfaceContext'
import type { PeekLoader } from './Peek'
import { PeekEntity } from './PeekCard'
import { PeekTable } from './PeekTable'
import { PeekTerm } from './PeekTerm'
import type { StatTerm } from './parts/statTerms'
import { TERM_SCHEMA, termAt } from './parts/statTerms'
import type { PeekSize } from './peekContext'
import { PEEK_PRESS_ATTRIBUTE } from './peekContext'
import type { PeekOpening } from './peekController'
import { PEEK_POPUP_ATTRIBUTE } from './peekController'
import { PEEK_PLATE } from './peekPlate'

/** The Peek's way out, under its card: a paper strip in the card's frame. */
const PEEK_OUT = {
  background: color.paper,
  border: `${borderWidth.entityCompact} solid ${color.ink}`,
  borderTop: 'none',
  padding: `${space[4]} ${space[8]}`,
} satisfies CSSProperties

/** A peek hangs at the overlay layer, over the page and its sticky bars. */
const PEEK_LAYER = { zIndex: layer.overlay } satisfies CSSProperties

/**
 * On a phone the Peek is a SHEET at the foot of the screen, never taller than
 * it: a card hung from its trigger has no room there, and one that opened
 * upward lost its name off the top.
 */
const PEEK_SHEET = {
  position: 'fixed',
  left: 0,
  right: 0,
  bottom: 0,
  zIndex: layer.overlay,
  display: 'flex',
  flexDirection: 'column',
  maxHeight: '80dvh',
  borderTop: `${borderWidth.entityCompact} solid ${color.ink}`,
  background: color.paper,
} satisfies CSSProperties

/**
 * The sheet's head: its Close, over the card and outside its scroll. A sheet
 * that covers most of a phone shows its own way out; Back and a press outside
 * still close it.
 */
const PEEK_SHEET_HEAD = {
  display: 'flex',
  flex: 'none',
  justifyContent: 'flex-end',
  padding: `${space[4]} ${space[8]}`,
} satisfies CSSProperties

/** The sheet's card scrolls inside it, so its way out stays at the foot. */
const PEEK_SHEET_CARD = {
  flex: '1 1 auto',
  minHeight: 0,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
} satisfies CSSProperties

/** The sheet's way out, pinned under the scrolling card. */
const PEEK_SHEET_OUT = {
  ...PEEK_OUT,
  flex: 'none',
  borderTop: PEEK_OUT.border,
} satisfies CSSProperties

/** A list's row (a Ledger's): a Peek from it stands clear of the row's columns (r6 G7). */
const LEDGER_ROW = '.su-ledger__table > tbody > tr'

/**
 * Where a Peek from a list's row hangs: under the whole row, at its trigger's
 * edge (the name's, an ability's or a trait's), so the columns it is read
 * beside stay in view. Read live, so it follows a scroll.
 */
function underRow(trigger: HTMLElement, row: HTMLElement, whole = false) {
  return {
    contextElement: trigger,
    getBoundingClientRect: () => {
      const own = whole ? row.getBoundingClientRect() : trigger.getBoundingClientRect()
      const line = row.getBoundingClientRect()
      return DOMRect.fromRect({
        x: own.left,
        y: line.top,
        width: own.width,
        height: line.height,
      })
    },
  }
}

/** The Peek plate's width, by its form: a contentful Mini's, else a Compact's. */
const plateWidth = (size: PeekSize | undefined) => (size === 'mini' ? 360 : 500)

/**
 * Where a Peek from a list's row stands so the rows a reader compares stay in
 * view (RR8-11): beside the list, level with the row, where the screen has
 * the room; else under the row at its far end, clear of the names and figures
 * read down its first columns. Read as the Peek opens.
 */
function besideList(trigger: HTMLElement, row: HTMLElement, width: number) {
  const list = row.closest('table') ?? row
  const room = (side: 'left' | 'right') => {
    const box = list.getBoundingClientRect()
    return side === 'right' ? window.innerWidth - box.right : box.left
  }
  const side = (['right', 'left'] as const).find((edge) => room(edge) >= width + 16)
  if (!side)
    return { at: underRow(trigger, row, true), side: 'bottom' as const, align: 'end' as const }
  return {
    at: {
      contextElement: trigger,
      getBoundingClientRect: () => {
        const box = list.getBoundingClientRect()
        const line = row.getBoundingClientRect()
        return DOMRect.fromRect({ x: box.left, y: line.top, width: box.width, height: line.height })
      },
    },
    side,
    align: 'start' as const,
  }
}

/** Whether the screen is a phone's (below the ladder's first rung), read as the Peek opens. */
function onPhone(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    !window.matchMedia(widthAtLeast('sm')).matches
  )
}

function isEntitySchema(name: string): name is EntitySchemaName {
  const names: ReadonlySet<string> = EntitySchemaNames
  return names.has(name)
}

/** What a Peek shows: an entity's card, or the roll table a record carries. */
type PeekSubject =
  | { kind: 'entity'; entity: RefEntity }
  | { kind: 'term'; term: StatTerm }
  | { kind: 'table'; name: string; table: RefObjectTable }

/**
 * What an address names, once its schema is loaded. `<hostId>/npc` (an
 * `embeddedPeekAddress`) is the crew NPC embedded in that record, synthesized
 * exactly as its host card nests it; `<hostId>/table` is the record's roll
 * table (a folded roll Mini Peeks it, `CardRollTable`).
 */
function subjectAt(schemaName: string, id: string): PeekSubject | undefined {
  if (schemaName === TERM_SCHEMA) {
    const term = termAt(id)
    return term ? { kind: 'term', term } : undefined
  }
  if (!isEntitySchema(schemaName) || !SalvageUnionReference.isLoaded(schemaName)) return undefined
  const [hostId, part] = id.split('/')
  const host = SalvageUnionReference.get(schemaName, hostId ?? id) as RefEntity | undefined
  if (!host) return undefined
  if (!part) return { kind: 'entity', entity: host }
  if (part === 'table') {
    const table = resolveTable(host)
    const named = 'tableName' in host && typeof host.tableName === 'string' ? host.tableName : null
    return table ? { kind: 'table', name: named ?? host.name, table } : undefined
  }
  const npc =
    part === 'npc'
      ? nestedEntityGroups(host).find((group) => group.kind === 'npc')?.entities[0]
      : undefined
  return npc ? { kind: 'entity', entity: npc as RefEntity } : undefined
}

/**
 * A card that cannot render (a schema it reads did not load) says so on the
 * plate, quietly (chrome K8): a Peek is terminal (no button, so no
 * `RecoveryPanel`), and an error that closes the Peek says nothing at all.
 * Reported, since catching it is what keeps it from the window's reporter.
 */
class PeekBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch(error: Error, info: ErrorInfo) {
    captureException(error, { componentStack: info.componentStack })
  }
  override render() {
    return this.state.failed ? (
      <EmptyState headline={entityCopy('notShown')} body={entityCopy('thisCardCouldNotBe')} />
    ) : (
      this.props.children
    )
  }
}

/**
 * The Peek's POPUP, positioned against its trigger (Base UI's preview card,
 * driven by `PeekHost`): the plate, and on it the entity's card once its
 * schema has loaded. It never takes focus; Escape and a press outside dismiss
 * it. Loaded lazily by `PeekHost`, with the card it draws.
 */
export function PeekPopup({
  id,
  anchor,
  schemaName,
  entityId,
  down = false,
  size = 'compact',
  how = 'hover',
  load,
  onDismiss,
}: {
  id: string
  anchor: HTMLElement
  schemaName: string
  entityId: string
  /** The trigger is damaged or destroyed: the card is down as it is. */
  down?: Down
  /** One form below the trigger's (E23): a Compact contentful, or a contentful Mini. */
  size?: PeekSize
  /**
   * How it opened. The keyboard's Peek stands above its line (r6 G8): the
   * reader Tabbing through a sentence reads on below it, never under the card.
   */
  how?: PeekOpening
  load: PeekLoader
  onDismiss: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  const [sheet] = useState(onPhone)
  // From a list's row the Peek stands beside the list, or under the row's far
  // end, clear of the rows compared (r6 G7, RR8-11).
  const row = anchor.closest<HTMLElement>(LEDGER_ROW)
  const place = useMemo(
    () => (row && !sheet ? besideList(anchor, row, plateWidth(size)) : undefined),
    [anchor, row, sheet, size]
  )
  const at = place?.at ?? anchor
  useEffect(() => {
    let live = true
    // A term is the app's own words: no schema to read.
    const ready = schemaName === TERM_SCHEMA ? Promise.resolve() : load(schemaName)
    ready.then(
      () => live && setLoaded(true),
      // A schema that will not load has nothing to show: the Peek closes and
      // the trigger still links or opens as it always did.
      () => live && onDismiss()
    )
    return () => {
      live = false
    }
  }, [load, schemaName, onDismiss])

  const subject = loaded ? subjectAt(schemaName, entityId) : undefined
  // The app's "View in the Reference" (the surface's): the Peek's way to the
  // entry's page, beside its name (E16). The SRD, which is the Reference, has none.
  const { externalLink } = useEntitySurface()
  const outLink =
    subject?.kind === 'entity' ? externalLink?.(subject.entity, { inPeek: true }) : undefined
  // A term's Peek (E27): the page its link names, said in words under the
  // card, for a reader whose pointer is already on the plate (a long press's too).
  const termHref =
    !outLink && anchor.hasAttribute(PEEK_PRESS_ATTRIBUTE) ? anchor.getAttribute('href') : null
  useEffect(() => {
    if (loaded && !subject) onDismiss()
  }, [loaded, subject, onDismiss])

  const card = subject ? (
    subject.kind === 'term' ? (
      <PeekTerm term={subject.term} />
    ) : subject.kind === 'table' ? (
      <PeekTable name={subject.name} table={subject.table} />
    ) : (
      <PeekEntity entity={subject.entity} down={down} size={size} fromRow={!!row} />
    )
  ) : null
  const out =
    outLink ??
    (termHref ? (
      // Its way out, never a tab stop (E16): the term is the keyboard's link.
      <InlineRef href={termHref} data-peek-out="" tabIndex={-1}>
        {entityCopy('openPage')}
      </InlineRef>
    ) : null)

  if (sheet) {
    return createPortal(
      <div
        id={id}
        role="tooltip"
        data-peek-sheet=""
        {...{ [PEEK_POPUP_ATTRIBUTE]: '' }}
        style={PEEK_SHEET}
      >
        <div style={PEEK_SHEET_HEAD}>
          <CloseButton label={entityCopy('close')} onClick={onDismiss} />
        </div>
        {card ? (
          <PeekBoundary>
            <div style={PEEK_SHEET_CARD}>{card}</div>
            {out && <div style={PEEK_SHEET_OUT}>{out}</div>}
          </PeekBoundary>
        ) : (
          <Skeleton />
        )}
      </div>,
      document.body
    )
  }

  return (
    <PreviewCard.Root
      open
      onOpenChange={(open) => {
        if (!open) onDismiss()
      }}
    >
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          anchor={at}
          // A trigger whose controls sit below it asks for the room above (r6 E20);
          // a Peek opened by focus sits above its line, a row's below the row (r6 G8).
          side={
            place?.side ??
            (anchor.getAttribute('data-peek-side') === 'top' || (how === 'focus' && !row)
              ? 'top'
              : 'bottom')
          }
          align={place?.align ?? 'start'}
          sideOffset={5}
          collisionPadding={8}
          style={PEEK_LAYER}
        >
          <PreviewCard.Popup
            id={id}
            role="tooltip"
            {...{ [PEEK_POPUP_ATTRIBUTE]: '' }}
            style={{
              ...PEEK_PLATE,
              background: 'transparent',
              maxHeight: '80vh',
              overflowY: 'auto',
              width: `${plateWidth(size)}px`,
            }}
          >
            {card ? (
              <PeekBoundary>
                {card}
                {out && <div style={PEEK_OUT}>{out}</div>}
              </PeekBoundary>
            ) : (
              <Skeleton />
            )}
          </PreviewCard.Popup>
        </PreviewCard.Positioner>
      </PreviewCard.Portal>
    </PreviewCard.Root>
  )
}
