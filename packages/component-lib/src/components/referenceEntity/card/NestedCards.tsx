import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useContext, useState } from 'react'
import type { SURefEntity, SURefMetaEntity } from 'salvageunion-reference'
import { getReferenceEntityName } from 'salvageunion-reference'
import { space } from '../../../design/tokens'
import { Entity } from '../../../entity/Entity'
import { InsidePeekContext } from '../../../entity/peekContext'
import type { EntityMode } from '../../../entity/types'
import { Button } from '../../chrome/Button'
import { Slab } from '../../chrome/Slab'
import type { CardSize } from '../../shared/displayMode'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { EntityDetailDialog } from '../EntityDetailDialog'
import { useEntityDetailLink, useEntityHref } from '../entityHrefContext'
import type { ReferenceEntityControl } from '../referenceEntityControlTypes'
import { cardKey } from './cardHelpers'
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
  /** The host IS the page: its trays drop the frame inset (see `CardTray`). */
  onPage?: boolean
  /** The host's display name (lets a nested action drop its ` (Host)` suffix). */
  entityName: string
  chassisName: string | undefined
  /** Prose the host already prints — a child hides any it would repeat. */
  shownProse: string[]
  /** Controls for each inline action band (see `actionControls` on the card). */
  actionControls?: (action: ReferenceCardEntity) => ReferenceEntityControl[] | undefined
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

/** The tray's inset from the frame, by the host's size (board E2). */
const TRAY_MARGIN: Record<CardSize, string> = {
  large: `${space[4]} ${space[14]} ${space[14]}`,
  medium: `${space[2]} ${space[10]} ${space[10]}`,
  small: `${space[2]} ${space[8]} ${space[8]}`,
}

const tray = (size: CardSize, flush: boolean): CSSProperties => ({
  backgroundColor: 'var(--color-wk-bg)',
  // Its own formatting context: beside a page's floated art the whole tray
  // narrows, rather than its ground running under the image.
  display: 'flow-root',
  border: 'var(--bw-hairline) solid var(--color-ink-20)',
  borderRadius: 'var(--radius-card)',
  margin: flush ? 0 : TRAY_MARGIN[size],
  padding: space[10],
})

/** The tray's cards, stacked under its head (the Slab keeps its own margin). */
const TRAY_STACK: CSSProperties = { display: 'flex', flexDirection: 'column', gap: space[14] }

/**
 * A TRAY of nested cards (board E2): a recessed tray in the page colour,
 * inside the parent's frame, headed by the section `Slab` — the ink stamp
 * naming the group and its count, then the dashed leader (ruleset §3.2: slabs
 * section). Containment and the seam stamp show the nesting; there is no
 * indent and no rail (ruleset §3.10).
 */
export function CardTray({
  label,
  count,
  size,
  as,
  flush = false,
  children,
}: {
  label: string
  count: number
  size: CardSize
  /** A real heading when the card IS the page (`sectionHeadingLevel`). */
  as?: ElementType
  /** On a page there is no frame to inset from: the tray spans the column. */
  flush?: boolean
  children: ReactNode
}) {
  return (
    <div style={tray(size, flush)}>
      <Slab variant="solid" as={as} label={`${label} · ${count}`} />
      <div style={TRAY_STACK}>{children}</div>
    </div>
  )
}

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
 * A list of nested cards, stacked in their tray. Depth 1 renders the full
 * medium card; from depth 2 a child is a one-line head row that opens the
 * entity rather than expanding in place (board E2).
 */
export function NestedCardList({
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
export function NestedRow({ data, host }: { data: ReferenceCardEntity; host: NestedCardHost }) {
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
 * A labelled group of nested entities in its tray. Grants also stamp a GRANTS
 * seal on each card (the granting ability's own actions belong to the granted
 * card).
 */
export function NestedCardGroup({
  label,
  entities,
  seal,
  sectionAs,
  host,
  write,
}: {
  label: string
  entities: ReferenceCardEntity[]
  seal?: { label: string; tone: string }
  sectionAs: ElementType | undefined
  host: NestedCardHost
  write?: NestedWrite
}) {
  if (entities.length === 0) return null
  return (
    <CardTray
      label={label}
      count={entities.length}
      size={host.size}
      as={sectionAs}
      flush={host.onPage}
    >
      <NestedCardList entities={entities} seal={seal} host={host} write={write} />
    </CardTray>
  )
}

/**
 * DRONE — a chassis controls a drone (named by a chassis ability); a pattern
 * specifies one or several. Each renders as a drone card in a Drone tray, and
 * its systems + modules render INSIDE that card (via `droneLoadout`).
 */
export function DroneCards({ drones, host }: { drones: DroneLoadout[]; host: NestedCardHost }) {
  const { NestedCard } = host
  const insidePeek = useContext(InsidePeekContext)
  if (drones.length === 0) return null
  if (insidePeek) {
    return (
      <CardTray
        label={drones.length === 1 ? 'Drone' : 'Drones'}
        count={drones.length}
        size={host.size}
      >
        <PeekTokens entities={drones.map((info) => info.drone)} />
      </CardTray>
    )
  }
  return (
    <CardTray
      label={drones.length === 1 ? 'Drone' : 'Drones'}
      count={drones.length}
      size={host.size}
      flush={host.onPage}
    >
      {drones.map((droneInfo, index) => (
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
          droneLoadout={{ systems: droneInfo.systems, modules: droneInfo.modules }}
        />
      ))}
    </CardTray>
  )
}

/**
 * ACTIONS sit INLINE in their card (board E1): each a flush ink band — name
 * and cost — then its "//" line and body. No tray and no "Action" stamp: an
 * action is part of the thing that does it, not a thing it carries. Titanic
 * actions are inline too, so the full-width row they needed is the default.
 */
export function InlineActions({
  actions,
  host,
}: {
  actions: ReferenceCardEntity[]
  host: NestedCardHost
}) {
  const { NestedCard } = host
  return actions.map((action, index) => (
    <NestedCard
      key={cardKey(action, index)}
      inline
      size={host.size}
      depth={host.depth + 1}
      hostDown={host.isDown}
      data={action}
      hostName={host.entityName}
      chassisName={host.chassisName}
      controls={host.actionControls?.(action)}
    />
  ))
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
