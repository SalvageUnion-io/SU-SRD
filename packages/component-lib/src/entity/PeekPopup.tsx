import { PreviewCard } from '@base-ui/react/preview-card'
import type { ReactNode } from 'react'
import { Component, useEffect, useState } from 'react'
import type { EntitySchemaName, SURefEntity } from 'salvageunion-reference'
import {
  EntitySchemaNames,
  nestedEntityGroups,
  SalvageUnionReference,
} from 'salvageunion-reference'
import { Skeleton } from '../components/containers/Skeleton'
import type { Down } from '../components/referenceEntity/card/cardChrome'
import type { PeekLoader } from './Peek'
import { PeekCard } from './PeekCard'
import { PEEK_POPUP_ATTRIBUTE } from './peekController'
import { PEEK_PLATE } from './peekPlate'

function isEntitySchema(name: string): name is EntitySchemaName {
  const names: ReadonlySet<string> = EntitySchemaNames
  return names.has(name)
}

/**
 * The entity an address names, once its schema is loaded. `<hostId>/npc` (an
 * `embeddedPeekAddress`) is the crew NPC embedded in that record, synthesized
 * exactly as its host card nests it.
 */
function entityAt(schemaName: string, id: string): SURefEntity | undefined {
  if (!isEntitySchema(schemaName) || !SalvageUnionReference.isLoaded(schemaName)) return undefined
  const [hostId, part] = id.split('/')
  const host = SalvageUnionReference.get(schemaName, hostId ?? id) as SURefEntity | undefined
  if (!part || !host) return host
  return part === 'npc'
    ? nestedEntityGroups(host).find((group) => group.label === 'NPCs')?.entities[0]
    : undefined
}

/** A card that cannot render (a schema it reads did not load) closes its Peek. */
class PeekBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  override componentDidCatch() {
    this.props.onError()
  }
  override render() {
    return this.state.failed ? null : this.props.children
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

  const entity = loaded ? entityAt(schemaName, entityId) : undefined
  useEffect(() => {
    if (loaded && !entity) onDismiss()
  }, [loaded, entity, onDismiss])

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
          style={{ zIndex: 50 }}
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
            {entity ? (
              <PeekBoundary onError={onDismiss}>
                <PeekCard entity={entity} down={down} />
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
