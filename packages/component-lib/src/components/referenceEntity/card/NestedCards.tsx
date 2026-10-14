import type { CSSProperties, ReactNode } from 'react'
import { useContext, useState } from 'react'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import { getReferenceEntityName } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { Entity } from '../../../entity/Entity'
import { InsidePeekContext } from '../../../entity/peekContext'
import type { EntityMode } from '../../../entity/types'
import { Button } from '../../atoms/Button'
import type { CardSize } from '../../containers/displayMode'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { EntityDetailDialog } from '../EntityDetailDialog'
import { useEntityDetailLink, useEntityHref } from '../entityHrefContext'
import { cardKey, stackedTitleLevel } from './cardHelpers'
import { nestedChildSize } from './entityCardTone'
import type {
  NestedCard,
  ReferenceCardEntity,
  ReferenceEntityCardHideConfig,
} from './referenceEntityCardTypes'
import type { DroneLoadout } from './resolveNestedEntities'
import { stripHostParenthetical } from './stripHostParenthetical'

/** What every nested card inherits from the card that nests it. */
export type NestedCardHost = {
  /** The HOST card's depth — nested cards render one level below it. */
  depth: number
  /** The host's size: a child renders medium, or small inside a small card. */
  size: CardSize
  isDown: boolean
  /** The host IS the page: its stacks drop the frame inset (see `CardStack`). */
  onPage?: boolean
  /** The host's display name (lets a nested action drop its ` (Host)` suffix). */
  entityName: string
  chassisName: string | undefined
  /** Prose the host already prints — a child hides any it would repeat. */
  shownProse: string[]
  NestedCard: NestedCard
}

/**
 * The write layer a group hands its depth-1 cards. A crawler bay's NPC shares
 * the parent's id-keyed selections map (distinct choice ids, no clash), so its
 * crew choices (Name / Motto / Keepsake) render as real inputs when editable;
 * the parent's `hide` governs its NPC too, so a bay that hides choices does not
 * surface the same ones here.
 */
export type NestedWrite = {
  selections: ChoiceSelections | undefined
  onSelectionChange: ((selections: ChoiceSelections) => void) | undefined
  hide: ReferenceEntityCardHideConfig | undefined
}

/** A stack's inset from the frame, by the host's size (board E2). */
const STACK_MARGIN: Record<CardSize, string> = {
  large: `${space[4]} ${space[14]} ${space[14]}`,
  medium: `${space[2]} ${space[10]} ${space[10]}`,
  small: `${space[2]} ${space[8]} ${space[8]}`,
}

/**
 * A bare stack of nested cards, inset from the frame: no ground and no head.
 * A flex box is its own formatting context, so beside a page's floated art it
 * narrows rather than running under the image.
 */
const stack = (size: CardSize, flush: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: space[14],
  margin: flush ? 0 : STACK_MARGIN[size],
})

/**
 * Nested cards that each wear their own type stamp (or GRANTS seal) — a
 * System, a Module, an NPC, a Drone, a Pattern. A tray headed "Systems" or
 * "NPC" would only repeat that stamp, so they stack in the parent's frame
 * without one (board E2). Containment and the stamp show the nesting; there
 * is no indent and no rail (ruleset §3.10).
 */
export function CardStack({
  size,
  flush = false,
  children,
}: {
  size: CardSize
  flush?: boolean
  children: ReactNode
}) {
  return <div style={stack(size, flush)}>{children}</div>
}

/**
 * What leads a framed card's nested elements. A GAP under the head when no
 * body pads it, so content never touches the header; and the card's own ROLL
 * TABLE, boxed at the nested width (owner's call, 2026-10-14: "nested elements
 * should not be full-width").
 */
export function CardLead({
  bare,
  nested,
  table,
  size,
}: {
  /** Nothing (no body, no sub-line) pads the head. */
  bare: boolean
  /** Nested elements follow the table. */
  nested: boolean
  table: ReactNode
  size: CardSize
}) {
  return (
    <>
      {bare && (table || nested) && <div aria-hidden="true" style={{ height: LEAD_GAP[size] }} />}
      {table && <CardStack size={size}>{table}</CardStack>}
    </>
  )
}

const LEAD_GAP: Record<CardSize, string> = { large: space[12], medium: space[10], small: space[8] }

/** Children inside a Peek: one read-only Token each, on a wrapping line (E16). */
function PeekTokens({ entities }: { entities: ReferenceCardEntity[] }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: space[4] }}>
      {entities.map((nested, index) => (
        <Entity
          key={cardKey(nested, index)}
          form="token"
          entity={nested as SURefMetaEntity}
          mode={{ kind: 'read' }}
        />
      ))}
    </div>
  )
}

/**
 * A crawler bay's crew NPC as a TOKEN that Peeks its card (owner's call,
 * 2026-10-14: "when nesting an NPC inside of a crawler bay, use a token with
 * peek"). The NPC is embedded in the bay, with no dataset row of its own, so
 * it Peeks through the bay's address (`embeddedPeekAddress`).
 */
export function EmbeddedNpcTokens({
  entities,
  host,
  peekAt,
}: {
  entities: ReferenceCardEntity[]
  host: NestedCardHost
  peekAt: string
}) {
  if (entities.length === 0) return null
  return (
    <CardStack size={host.size} flush={host.onPage}>
      <ul className="su-entity-token-list">
        {entities.map((npc, index) => (
          <li key={cardKey(npc, index)}>
            <Entity form="token" entity={npc as SURefMetaEntity} peekAt={peekAt} />
          </li>
        ))}
      </ul>
    </CardStack>
  )
}

/**
 * A list of nested cards, stacked. Depth 1 renders the full
 * medium card; from depth 2 a child is a one-line head row that opens the
 * entity rather than expanding in place (board E2).
 */
function NestedCardList({
  entities,
  seal,
  host,
  write,
}: {
  entities: ReferenceCardEntity[]
  seal?: { label: string; tone: string }
  host: NestedCardHost
  write?: NestedWrite
}) {
  const { NestedCard } = host
  const depth = host.depth + 1
  // A Peek draws its children as Tokens only (E16).
  if (useContext(InsidePeekContext)) return <PeekTokens entities={entities} />
  return entities.map((nested, index) =>
    depth >= 2 ? (
      <NestedRow key={cardKey(nested, index)} data={nested} host={host} />
    ) : (
      <NestedCard
        key={cardKey(nested, index)}
        size={nestedChildSize(host.size)}
        depth={depth}
        hostDown={host.isDown}
        data={nested}
        parentSeal={seal}
        // On a page, a section heading of its own: no band stands above it.
        titleAs={stackedTitleLevel(host.onPage)}
        hostName={host.entityName}
        chassisName={host.chassisName}
        shownProse={host.shownProse}
        // Thread the write layer when the group asks for it (a bay's crew).
        {...write}
      />
    )
  )
}

/**
 * A DEPTH-2 child: a Row (board E2, entity display language E6), the third
 * level as a link. It opens the entity instead of expanding in place — the
 * detail page where the app links out (srd, an `EntityDetailLinkProvider` and
 * an href), else the detail modal (ITUN). A synthesised entity (no dataset
 * row) and a Row inside a tooltip are read-only.
 */
function NestedRow({ data, host }: { data: ReferenceCardEntity; host: NestedCardHost }) {
  const { NestedCard } = host
  const [open, setOpen] = useState(false)
  const insidePeek = useContext(InsidePeekContext)
  const href = useEntityHref(data as SURefEntity)
  const linkOut = useEntityDetailLink() && !!href
  const entityName = getReferenceEntityName(data) ?? 'Entity details'
  // A nested ACTION drops its ` (Host)` suffix: its host is right above it.
  const title = stripHostParenthetical(entityName, host.entityName)
  const instance = { title, ...(host.isDown ? { condition: 'damaged' as const } : {}) }
  const mode: EntityMode = insidePeek
    ? { kind: 'read' }
    : linkOut
      ? { kind: 'link', href, attrs: { 'aria-label': `Open ${entityName}` } }
      : {
          kind: 'link',
          onOpen: () => setOpen(true),
          attrs: { 'aria-label': `Open ${entityName}` },
        }
  return (
    <>
      <Entity form="row" entity={data as SURefMetaEntity} instance={instance} mode={mode} />
      {mode.kind === 'link' && mode.onOpen && (
        <EntityDetailDialog open={open} onOpenChange={setOpen} title={entityName}>
          <NestedCard data={data} chassisName={host.chassisName} />
        </EntityDetailDialog>
      )}
    </>
  )
}

/**
 * A group of nested entities — Systems, Modules, NPCs, Grants — stacked with
 * no tray: each card's own stamp names it. Grants also stamp a GRANTS seal on
 * each card (the granting ability's own actions belong to the granted card).
 */
export function NestedCardGroup({
  entities,
  seal,
  host,
  write,
}: {
  entities: ReferenceCardEntity[]
  seal?: { label: string; tone: string }
  host: NestedCardHost
  write?: NestedWrite
}) {
  if (entities.length === 0) return null
  return (
    <CardStack size={host.size} flush={host.onPage}>
      <NestedCardList entities={entities} seal={seal} host={host} write={write} />
    </CardStack>
  )
}

/**
 * DRONE — a chassis controls a drone (named by a chassis ability); a pattern
 * specifies one or several. Each renders as a drone card (no tray), and
 * its systems + modules render INSIDE that card (via `droneLoadout`).
 */
export function DroneCards({ drones, host }: { drones: DroneLoadout[]; host: NestedCardHost }) {
  const { NestedCard } = host
  const insidePeek = useContext(InsidePeekContext)
  if (drones.length === 0) return null
  if (insidePeek) {
    return (
      <CardStack size={host.size}>
        <PeekTokens entities={drones.map((info) => info.drone)} />
      </CardStack>
    )
  }
  const cards = drones.map((droneInfo, index) => (
    <NestedCard
      key={`drone-${droneInfo.instanceName ?? index}`}
      size={nestedChildSize(host.size)}
      depth={host.depth + 1}
      hostDown={host.isDown}
      data={droneInfo.drone}
      chassisName={host.chassisName}
      shownProse={host.shownProse}
      // A pattern-named instance ('Shield Drone') titles the card; the stat
      // block it rides on ('Big Brother Drone') still supplies every stat,
      // trait and content block below.
      titleOverride={droneInfo.instanceName}
      titleAs={stackedTitleLevel(host.onPage)}
      droneLoadout={{ systems: droneInfo.systems, modules: droneInfo.modules }}
    />
  ))
  // The drone card's own type stamp says what it is: no tray, no "Drone" slab.
  return (
    <CardStack size={host.size} flush={host.onPage}>
      {cards}
    </CardStack>
  )
}

/**
 * ACTIONS nest in their card (owner's call, 2026-10-14): each a self-contained
 * framed card, inset in the parent's frame like any nested entity (`CardStack`),
 * its cut-out ink head carrying the name and its chips, then its body. No tray
 * and no "Action" stamp: an action is part of the thing that does it.
 */
export function InlineActions({
  actions,
  host,
}: {
  actions: ReferenceCardEntity[]
  host: NestedCardHost
}) {
  const { NestedCard } = host
  return (
    <CardStack size={host.size} flush={host.onPage}>
      {actions.map((action, index) => (
        <NestedCard
          key={cardKey(action, index)}
          size={nestedChildSize(host.size)}
          depth={host.depth + 1}
          hostDown={host.isDown}
          data={action}
          hostName={host.entityName}
          chassisName={host.chassisName}
        />
      ))}
    </CardStack>
  )
}

/** The card's gutter by size — what a chip or a section aligns to. */
const GUTTER: Record<CardSize, string> = { large: space[14], medium: space[10], small: space[8] }

/**
 * Below depth 1 a card's actions fold behind a "Show N actions" chip that
 * expands them in place (board E2); depth 1 keeps them open.
 */
export function ActionsChip({
  count,
  size,
  children,
}: {
  count: number
  size: CardSize
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  // Terminal in a tooltip popup: no chip to press.
  if (useContext(InsidePeekContext)) return null
  const noun = count === 1 ? 'action' : 'actions'
  return (
    <>
      <div style={{ padding: `${space[8]} ${GUTTER[size]}` }}>
        <Button size="compact" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
          {open ? `Hide ${count} ${noun}` : `Show ${count} ${noun}`}
        </Button>
      </div>
      {open && children}
    </>
  )
}
