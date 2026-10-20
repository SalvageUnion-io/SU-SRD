import { PreviewCard } from '@base-ui/react/preview-card'
import type { CSSProperties, ErrorInfo, ReactNode } from 'react'
import { Component, useEffect, useState } from 'react'
import type { EntitySchemaName, RefEntity, RefObjectTable } from 'salvageunion-reference'
import {
  EntitySchemaNames,
  nestedEntityGroups,
  resolveTable,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { layer } from '../../design/tokens'
import { captureException } from '../../lib/observability'
import { EmptyState } from '../containers/EmptyState'
import { Skeleton } from '../containers/Skeleton'
import type { Down } from '../referenceEntity/card/cardChrome'
import type { PeekLoader } from './Peek'
import { PeekCard } from './PeekCard'
import { PeekTable } from './PeekTable'
import { PEEK_POPUP_ATTRIBUTE } from './peekController'
import { PEEK_PLATE } from './peekPlate'

/** A peek hangs at the overlay layer, over the page and its sticky bars. */
const PEEK_LAYER = { zIndex: layer.overlay } satisfies CSSProperties

function isEntitySchema(name: string): name is EntitySchemaName {
  const names: ReadonlySet<string> = EntitySchemaNames
  return names.has(name)
}

/** What a Peek shows: an entity's card, or the roll table a record carries. */
type PeekSubject =
  | { kind: 'entity'; entity: RefEntity }
  | { kind: 'table'; name: string; table: RefObjectTable }

/**
 * What an address names, once its schema is loaded. `<hostId>/npc` (an
 * `embeddedPeekAddress`) is the crew NPC embedded in that record, synthesized
 * exactly as its host card nests it; `<hostId>/table` is the record's roll
 * table (a folded roll Mini Peeks it, `CardRollTable`).
 */
function subjectAt(schemaName: string, id: string): PeekSubject | undefined {
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
      ? nestedEntityGroups(host).find((group) => group.label === 'NPCs')?.entities[0]
      : undefined
  return npc ? { kind: 'entity', entity: npc as RefEntity } : undefined
}

/**
 * A card that cannot render (a schema it reads did not load) says so on the
 * plate, quietly (chrome.md K8): a Peek is terminal (no button, so no
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
      <EmptyState headline="Not shown" body="This card could not be drawn here." />
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
  load,
  onDismiss,
}: {
  id: string
  anchor: HTMLElement
  schemaName: string
  entityId: string
  /** The trigger is damaged or destroyed: the card is down as it is. */
  down?: Down
  load: PeekLoader
  onDismiss: () => void
}) {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => {
    let live = true
    load(schemaName).then(
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
  useEffect(() => {
    if (loaded && !subject) onDismiss()
  }, [loaded, subject, onDismiss])

  return (
    <PreviewCard.Root
      open
      onOpenChange={(open) => {
        if (!open) onDismiss()
      }}
    >
      <PreviewCard.Portal>
        <PreviewCard.Positioner
          anchor={anchor}
          side="bottom"
          align="start"
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
              width: '500px',
            }}
          >
            {subject ? (
              <PeekBoundary>
                {subject.kind === 'table' ? (
                  <PeekTable name={subject.name} table={subject.table} />
                ) : (
                  <PeekCard entity={subject.entity} down={down} />
                )}
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
