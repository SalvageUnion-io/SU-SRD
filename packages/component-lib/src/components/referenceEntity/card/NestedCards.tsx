import type { ElementType } from 'react'
import { Slab } from '../../chrome/Slab'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { cardKey, wrapFlat } from './cardHelpers'
import type {
  NestedCard,
  ReferenceCardEntity,
  ReferenceEntityCardHideConfig,
} from './referenceEntityCardTypes'
import type { DroneLoadout } from './resolveNestedEntities'

/** What every nested card inherits from the card that nests it. */
export type NestedCardHost = {
  /** The HOST card's depth — nested cards render one level below it. */
  depth: number
  isDown: boolean
  /** The host's display name (lets a nested action drop its ` (Host)` suffix). */
  entityName: string
  chassisName: string | undefined
  compact: boolean
  NestedCard: NestedCard
}

/**
 * A list of nested cards. FLAT mode (the host body has a left ANCHOR — image or
 * NPC) renders each card as a `flow-root` block so it flows beside the floated
 * anchor, then full width once past it. A COMPACT host stacks them one per row
 * (a compact card is narrow, so a 2-up masonry cramps its nested cards); a full
 * host uses the 2-col masonry, with an odd last card spanning the width.
 */
export function NestedCardList({
  entities,
  seal,
  childHostTone,
  flat = false,
  host,
}: {
  entities: ReferenceCardEntity[]
  seal?: { label: string; tone: string }
  childHostTone?: string
  flat?: boolean
  host: NestedCardHost
}) {
  const { NestedCard } = host
  // The ONE nested-card construction all three layouts share.
  const card = (nested: ReferenceCardEntity, index: number) => (
    <NestedCard
      key={cardKey(nested, index)}
      size="medium"
      depth={host.depth + 1}
      hostDown={host.isDown}
      data={nested}
      parentSeal={seal}
      hostTone={childHostTone}
      hostName={host.entityName}
      chassisName={host.chassisName}
    />
  )
  if (flat) {
    return entities.map((nested, index) =>
      wrapFlat(true, cardKey(nested, index), card(nested, index))
    )
  }
  if (host.compact) {
    return (
      <div className="flex flex-col gap-1.5">
        {entities.map((nested, index) => card(nested, index))}
      </div>
    )
  }
  const isOdd = entities.length % 2 === 1
  const columnCards = isOdd ? entities.slice(0, -1) : entities
  const orphan = isOdd ? entities[entities.length - 1] : undefined
  return (
    <>
      {columnCards.length > 0 && (
        <div className="columns-1 gap-1.5 sm:columns-2">
          {columnCards.map((nested, index) => (
            <div key={cardKey(nested, index)} className="mb-1.5 break-inside-avoid">
              {card(nested, index)}
            </div>
          ))}
        </div>
      )}
      {orphan && card(orphan, entities.length - 1)}
    </>
  )
}

/**
 * A labelled group of nested cards. Grants → NO Slab, a "GRANTS" stampseal on
 * each nested card. NPCs → NO Slab. Everything else (Systems/Modules/Drones)
 * keeps its dashed Slab separator.
 */
export function NestedCardGroup({
  label,
  entities,
  slab = true,
  seal,
  childHostTone,
  flat = false,
  sectionAs,
  host,
}: {
  label: string
  entities: ReferenceCardEntity[]
  slab?: boolean
  seal?: { label: string; tone: string }
  childHostTone?: string
  flat?: boolean
  sectionAs: ElementType | undefined
  host: NestedCardHost
}) {
  return (
    <div className={flat ? 'mb-1.5' : 'flex flex-col gap-1.5'}>
      {/* Nested cards resolve `sectionAs` to undefined themselves — no depth check needed. */}
      {slab && <Slab variant="dashed" label={label} as={sectionAs} />}
      <NestedCardList
        entities={entities}
        seal={seal}
        childHostTone={childHostTone}
        flat={flat}
        host={host}
      />
    </div>
  )
}

/** A dashed-Slab group of LISTING rows (a drone's systems / modules) — flat-aware. */
export function ListingGroup({
  label,
  entities,
  flat = false,
  host,
}: {
  label: string
  entities: ReferenceCardEntity[]
  flat?: boolean
  host: NestedCardHost
}) {
  const { NestedCard } = host
  return (
    <div className={flat ? 'mb-1.5' : 'flex flex-col gap-1'}>
      <Slab variant="dashed" label={label} />
      {entities.map((item, index) =>
        wrapFlat(
          flat,
          cardKey(item, index),
          <NestedCard
            key={cardKey(item, index)}
            size="medium"
            extent="head"
            depth={host.depth + 1}
            hostDown={host.isDown}
            data={item}
          />
        )
      )}
    </div>
  )
}

/**
 * DRONE — a chassis controls a drone (named by a chassis ability); a pattern
 * specifies one or several. Each renders as a compact drone card, and its
 * systems + modules render INSIDE that card (via the `droneLoadout` prop), not
 * at the host level.
 */
export function DroneCards({
  drones,
  flat,
  host,
}: {
  drones: DroneLoadout[]
  flat: boolean
  host: NestedCardHost
}) {
  const { NestedCard } = host
  return drones.map((droneInfo, index) =>
    wrapFlat(
      flat,
      `drone-${droneInfo.instanceName ?? index}`,
      <NestedCard
        // The key rides the CARD, not only `wrapFlat`'s wrapper: `wrapFlat`
        // drops the key it is handed when `flat` is false, and a pattern card is
        // now never flat (it takes the aside lead), so every multi-drone pattern
        // rendered keyless list children. Every other `wrapFlat` call site
        // already sets it.
        key={`drone-${droneInfo.instanceName ?? index}`}
        size="medium"
        depth={host.depth + 1}
        hostDown={host.isDown}
        data={droneInfo.drone}
        chassisName={host.chassisName}
        // A pattern-named instance ('Shield Drone') titles the card; the stat
        // block it rides on ('Big Brother Drone') still supplies every stat,
        // trait and content block below.
        titleOverride={droneInfo.instanceName}
        droneLoadout={{ systems: droneInfo.systems, modules: droneInfo.modules }}
      />
    )
  )
}

/** TITANIC actions — a full-width row of their own each, never the masonry. */
export function TitanicActionCards({
  actions,
  flat,
  hostTone,
  host,
}: {
  actions: ReferenceCardEntity[]
  flat: boolean
  hostTone: string
  host: NestedCardHost
}) {
  const { NestedCard } = host
  return actions.map((action, index) =>
    wrapFlat(
      flat,
      cardKey(action, index),
      <NestedCard
        key={cardKey(action, index)}
        size="medium"
        depth={host.depth + 1}
        hostDown={host.isDown}
        data={action}
        hostTone={hostTone}
        hostName={host.entityName}
        chassisName={host.chassisName}
      />
    )
  )
}

/**
 * The LEFT ANCHOR when there is no artwork: a prominent nested NPC (a crawler
 * bay's crew), floated so the body flows beside it.
 */
export function NpcAnchor({
  npcs,
  hostTone,
  selections,
  onSelectionChange,
  hide,
  host,
}: {
  npcs: ReferenceCardEntity[]
  hostTone: string
  selections: ChoiceSelections | undefined
  onSelectionChange: ((selections: ChoiceSelections) => void) | undefined
  hide: ReferenceEntityCardHideConfig | undefined
  host: NestedCardHost
}) {
  const { NestedCard } = host
  return (
    <div className="mb-1.5 w-full shrink-0 md:float-right md:w-1/2 md:max-w-full md:pl-3">
      {npcs.map((npc, index) => (
        <NestedCard
          key={cardKey(npc, index)}
          size="medium"
          depth={host.depth + 1}
          hostDown={host.isDown}
          data={npc}
          hostTone={hostTone}
          hostName={host.entityName}
          chassisName={host.chassisName}
          // Thread the write-layer so the NPC's crew choices (Name / Motto /
          // Keepsake) render as real inputs in editable mode — they share the
          // parent's id-keyed selections map (distinct choice ids, no clash).
          selections={selections}
          onSelectionChange={onSelectionChange}
          // The parent's visibility config governs its identity NPC too — a bay
          // that hides choices (rendering the NPC's crew facts as external
          // IdentityFields) must not also surface those same choices here.
          hide={hide}
        />
      ))}
    </div>
  )
}
