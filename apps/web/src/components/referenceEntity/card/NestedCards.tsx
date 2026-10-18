import type { CSSProperties, ReactNode } from 'react'
import { useContext, useState } from 'react'
import type { RefEntity, RefMetaEntity } from 'salvageunion-reference'
import { getReferenceEntityName, resolveTable } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import type { CardSize } from '../../containers/displayMode'
import { Entity } from '../../entity/Entity'
import { InsidePeekContext, tablePeekAddress } from '../../entity/peekContext'
import type { EntityMode } from '../../entity/types'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { EntityDetailDialog } from '../EntityDetailDialog'
import { useEntityDetailLink, useEntityHref } from '../entityHrefContext'
import { CardRollTable } from './CardRollTable'
import type { Down } from './cardChrome'
import { conditionOf } from './cardChrome'
import { cardKey, stackedTitleLevel } from './cardHelpers'
import { nestedChildSize } from './entityCardTone'
import { nestsTokens } from './nestingLevel'
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
  isDown: Down
  /**
   * The host IS the page: its stacks drop the frame inset (see `CardStack`).
   * It is also the host's nesting level (N1, EDL E6): a Page is level 0, so
   * what it nests is level 1, a compact Card. Every other host (a Card on a
   * Page, a card in a wizard pick, a sheet, a dialog list) is itself at
   * level 1 or deeper, so what it nests is level 2: a Token (`nestsTokens`).
   */
  onPage?: boolean
  /**
   * The host's prose reads at the regular size (a page, a large card, a
   * `readable` card): its depth-1 children then read at it too, so every
   * nested card in one host has one body size, the host's.
   */
  readableProse?: boolean
  /** The host's display name (lets a nested action drop its ` (Host)` suffix). */
  entityName: string
  chassisName: string | undefined
  /** Prose the host already prints — a child hides any it would repeat. */
  shownProse: string[]
  NestedCard: NestedCard
}

/**
 * The write layer a group hands the level-1 cards a Page nests. A crawler bay's NPC shares
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
  full: `${space[4]} ${space[14]} ${space[14]}`,
  compact: `${space[2]} ${space[10]} ${space[10]}`,
  mini: `${space[2]} ${space[8]} ${space[8]}`,
}

/**
 * A bare stack of nested cards, inset from the frame: no ground and no head.
 * A flex box is its own formatting context, so beside a page's floated art it
 * narrows rather than running under the image.
 *
 * On a page (`flush`) the stack sets no margin at all: the page's own rhythm
 * (`.su-entity-page`'s gap, `--flow`'s `* + *` margin) spaces it from the
 * prose and from the next stack, and an inline `margin: 0` would beat that
 * rule and butt the cards together. Its cards keep the same page rhythm.
 */
const stack = (size: CardSize, flush: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  gap: flush ? space[12] : space[14],
  ...(flush ? {} : { margin: STACK_MARGIN[size] }),
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

const LEAD_GAP: Record<CardSize, string> = { full: space[12], compact: space[10], mini: space[8] }

/** Children inside a Peek: one read-only Token each (E16), one a line (N4). */
function PeekTokens({ entities }: { entities: ReferenceCardEntity[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: space[4] }}>
      {entities.map((nested, index) => (
        <Entity
          key={cardKey(nested, index)}
          form="token"
          context="loadout"
          entity={nested as RefMetaEntity}
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
            <Entity form="token" context="roster" entity={npc as RefMetaEntity} peekAt={peekAt} />
          </li>
        ))}
      </ul>
    </CardStack>
  )
}

/**
 * A list of nested entities (N1, EDL E6). A Page's children are level 1: each
 * the full medium card, stacked. Any other host is itself level 1 or deeper,
 * so its children are level 2: one header-only Token a line (`NestedTokens`)
 * that opens the entity rather than expanding in place.
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
  // A Peek draws its children as Tokens only (E16).
  if (useContext(InsidePeekContext)) return <PeekTokens entities={entities} />
  if (nestsTokens(host)) {
    return <NestedTokens items={entities.map((data) => ({ data }))} host={host} />
  }
  return entities.map((nested, index) => (
    <NestedCard
      key={cardKey(nested, index)}
      size={nestedChildSize(host.size)}
      depth={host.depth + 1}
      hostDown={host.isDown}
      data={nested}
      parentSeal={seal}
      readable={host.readableProse}
      // On a page, a section heading of its own: no band stands above it.
      titleAs={stackedTitleLevel(host.onPage)}
      hostName={host.entityName}
      chassisName={host.chassisName}
      shownProse={host.shownProse}
      // Thread the write layer when the group asks for it (a bay's crew).
      {...write}
    />
  ))
}

/** One level-2 child: the entity, and the title it goes by here (a pattern's drone name). */
type NestedTokenItem = { data: ReferenceCardEntity; title?: string }

/**
 * LEVEL-2 children (N1): one header-only Token a line, each filling it (N4),
 * as a pattern's loadout lists its parts (`PatternLoadout`). What the entity
 * carries (its loadout, its actions) is its Peek's and its Page's, never
 * nested here.
 */
function NestedTokens({ items, host }: { items: NestedTokenItem[]; host: NestedCardHost }) {
  return (
    <ul className="su-entity-token-list">
      {items.map((item, index) => (
        <li key={cardKey(item.data, index)}>
          <NestedToken data={item.data} title={item.title} host={host} />
        </li>
      ))}
    </ul>
  )
}

/**
 * A LEVEL-2 child as a Token that opens the entity instead of expanding in
 * place: the detail page where the app links out (srd, an
 * `EntityDetailLinkProvider` and an href), else the detail dialog's Page (The
 * App). It Peeks its whole card; a synthesised entity (no dataset row)
 * has no Peek, only its Page.
 */
function NestedToken({
  data,
  title: titleOverride,
  host,
}: {
  data: ReferenceCardEntity
  title: string | undefined
  host: NestedCardHost
}) {
  const { NestedCard } = host
  const [open, setOpen] = useState(false)
  const href = useEntityHref(data as RefEntity)
  const linkOut = useEntityDetailLink() && !!href
  const entityName = getReferenceEntityName(data) ?? 'Entity details'
  // A nested ACTION drops its ` (Host)` suffix: its host is right above it.
  const title = titleOverride ?? stripHostParenthetical(entityName, host.entityName)
  const condition = conditionOf(host.isDown)
  const instance = { title, ...(condition ? { condition } : {}) }
  const mode: Extract<EntityMode, { kind: 'link' }> = linkOut
    ? { kind: 'link', href, attrs: { 'aria-label': `Open ${title}` } }
    : {
        kind: 'link',
        onOpen: () => setOpen(true),
        attrs: { 'aria-label': `Open ${title}` },
      }
  return (
    <>
      <Entity
        form="token"
        context="loadout"
        entity={data as RefMetaEntity}
        instance={instance}
        mode={mode}
      />
      {mode.onOpen && (
        // The Page (EDL Form 5): the dialog's band and foot, the card its body.
        <EntityDetailDialog
          open={open}
          onOpenChange={setOpen}
          entity={data as RefMetaEntity}
          title={entityName}
        >
          <NestedCard data={data} chassisName={host.chassisName} presentation="page" />
        </EntityDetailDialog>
      )}
    </>
  )
}

/**
 * A group of nested entities — Systems, Modules, NPCs, Grants — stacked with
 * no tray: each card's own stamp names it. Grants also stamp a GRANTS seal on
 * each card (the granting ability's own actions belong to the granted card).
 * Under any host but a Page they are Tokens instead (N1, `NestedCardList`).
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
 * specifies one or several. On a Page each renders as a drone card (no tray),
 * and its systems + modules render INSIDE that card (via `droneLoadout`), as
 * Tokens. Anywhere else the drone is level 2 (N1): a Token under the name the
 * pattern gives it, its loadout its Peek's and its Page's.
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
  if (nestsTokens(host)) {
    return (
      <CardStack size={host.size}>
        <NestedTokens
          items={drones.map((info) => ({ data: info.drone, title: info.instanceName }))}
          host={host}
        />
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
      readable={host.readableProse}
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
 * ACTIONS nest in their card (owner's call, 2026-10-14): no tray and no
 * "Action" stamp, an action is part of the thing that does it. Their form is
 * the host's level (N1, N3). A Page lays its own out, level 1, as framed
 * cards (`CardPage`), so the actions drawn here are always under a Card or a
 * Peek: level 2, contentful Tokens (`ActionTokens`), never a framed card and
 * never folded away.
 */
export function InlineActions({
  actions,
  host,
}: {
  actions: ReferenceCardEntity[]
  host: NestedCardHost
}) {
  return (
    <CardStack size={host.size}>
      <ActionTokens
        actions={actions}
        size={nestedChildSize(host.size)}
        hostName={host.entityName}
        chassisName={host.chassisName}
        hostDown={host.isDown}
      />
    </CardStack>
  )
}

/** Contentful action Tokens a line apart: each one's text ends before the next one's head. */
const ACTION_LIST = { gap: space[12] } satisfies CSSProperties

/** An action and, under it, its roll table's line. */
const ACTION_ITEM = { flexDirection: 'column', gap: space[4] } satisfies CSSProperties

/**
 * LEVEL-2 actions (N3): one CONTENTFUL Token each, its head the action's name
 * (less its ` (Host)` suffix, its host right above it) with its type, range,
 * traits and cost, then its rules, every paragraph. An action that names a
 * roll table keeps it on the line under its text, folded as a nested table is
 * (E14: Token, Table, Roll the Die), never inside the Token, which nests
 * nothing (E6). Its choices are its Peek's and its Page's. Inside a Peek the
 * Token reads and the table is left out: a Peek is terminal (E16).
 */
export function ActionTokens({
  actions,
  size,
  hostName,
  chassisName,
  hostDown,
}: {
  actions: readonly ReferenceCardEntity[]
  /** The size a table opens at. */
  size: CardSize
  /** The host's display name, whose ` (Host)` suffix the actions drop. */
  hostName: string
  /** What `[(CHASSIS)]` reads as in the text. */
  chassisName: string | undefined
  hostDown?: Down
}) {
  const insidePeek = useContext(InsidePeekContext)
  const condition = conditionOf(hostDown ?? false)
  return (
    <ul className="su-entity-token-list" style={ACTION_LIST}>
      {actions.map((action, index) => {
        const name = getReferenceEntityName(action) ?? ''
        const title = stripHostParenthetical(name, hostName)
        const table = insidePeek ? undefined : resolveTable(action)
        const tableName =
          'tableName' in action && typeof action.tableName === 'string' ? action.tableName : title
        return (
          <li key={cardKey(action, index)} style={ACTION_ITEM}>
            <Entity
              form="token"
              context="play"
              entity={action as RefMetaEntity}
              instance={{ title, ...(condition ? { condition } : {}) }}
              body={{ chassisName }}
            />
            {table && (
              <CardRollTable
                table={table}
                name={tableName}
                size={size}
                disabled={!!hostDown}
                nested
                peekAt={tablePeekAddress(action)}
              />
            )}
          </li>
        )
      })}
    </ul>
  )
}
