import type { CSSProperties, ElementType, ReactNode } from 'react'
import { useState } from 'react'
import type { SURefEntity } from 'salvageunion-reference'
import { getReferenceEntityName } from 'salvageunion-reference'
import { font, fontSize, space, tracking, weight } from '../../../design/tokens'
import { Button } from '../../chrome/Button'
import { FOCUS_RING } from '../../chrome/interaction'
import type { CardSize } from '../../shared/displayMode'
import type { ChoiceSelections } from '../choiceCard/choiceSelectionHelpers'
import { EntityDetailDialog } from '../EntityDetailDialog'
import { useEntityDetailLink, useEntityHref } from '../entityHrefContext'
import { cardKey } from './cardHelpers'
import { nestedChildSize } from './entityCardTone'
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
  /** The host's size: a child renders medium, or small inside a small card. */
  size: CardSize
  isDown: boolean
  /** The host's display name (lets a nested action drop its ` (Host)` suffix). */
  entityName: string
  chassisName: string | undefined
  /** Prose the host already prints — a child hides any it would repeat. */
  shownProse: string[]
  NestedCard: NestedCard
}

/** The tray's inset from the frame, by the host's size (board E2). */
const TRAY_MARGIN: Record<CardSize, string> = {
  large: `${space[4]} ${space[14]} ${space[14]}`,
  medium: `${space[2]} ${space[10]} ${space[10]}`,
  small: `${space[2]} ${space[8]} ${space[8]}`,
}

const tray = (size: CardSize): CSSProperties => ({
  backgroundColor: 'var(--color-wk-bg)',
  border: 'var(--bw-hairline) solid var(--color-ink-20)',
  borderRadius: 'var(--radius-card)',
  display: 'flex',
  flexDirection: 'column',
  gap: space[14],
  margin: TRAY_MARGIN[size],
  padding: space[10],
})

/**
 * A TRAY of nested cards (board E2): a recessed tray in the page colour,
 * inside the parent's frame, headed by a stamp-and-leader label naming the
 * group and its count — the book's section device at card scale. Containment
 * and the seam stamp show the nesting; there is no indent and no rail
 * (ruleset §3.10).
 */
export function CardTray({
  label,
  count,
  size,
  as,
  children,
}: {
  label: string
  count: number
  size: CardSize
  /** A real heading when the card IS the page (`sectionHeadingLevel`). */
  as?: ElementType
  children: ReactNode
}) {
  const Label = as ?? 'span'
  return (
    <div style={tray(size)}>
      <div style={{ alignItems: 'center', display: 'flex', gap: space[8] }}>
        <Label
          style={{
            backgroundColor: 'var(--color-ink)',
            color: 'var(--color-paper)',
            fontFamily: font.cond,
            fontSize: size === 'small' ? fontSize.badge : fontSize.xs,
            fontWeight: weight.bold,
            letterSpacing: tracking.capsSnug,
            lineHeight: 1.2,
            margin: 0,
            padding: `${space[2]} ${space[6]}`,
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
          }}
        >
          {label} · {count}
        </Label>
        <span
          aria-hidden="true"
          style={{ borderTop: 'var(--bw-chrome) dashed var(--color-ink-40)', flex: 1 }}
        />
      </div>
      {children}
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
}: {
  entities: ReferenceCardEntity[]
  seal?: { label: string; tone: string }
  host: NestedCardHost
}) {
  const { NestedCard } = host
  const depth = host.depth + 1
  return entities.map((nested, index) =>
    depth >= 2 ? (
      <NestedRow key={cardKey(nested, index)} data={nested} depth={depth} host={host} />
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
      />
    )
  )
}

/**
 * A DEPTH-2 child: the header-only, one-line, clickable row (board E2). It
 * opens the entity instead of expanding in place — the detail page where the
 * app links out (srd, an `EntityDetailLinkProvider` and an href), else the
 * detail modal (ITUN).
 */
export function NestedRow({
  data,
  depth,
  host,
}: {
  data: ReferenceCardEntity
  depth: number
  host: NestedCardHost
}) {
  const { NestedCard } = host
  const [open, setOpen] = useState(false)
  const href = useEntityHref(data as SURefEntity)
  const linkOut = useEntityDetailLink() && !!href
  const name = getReferenceEntityName(data) ?? 'Entity details'
  const row = (onCardClick?: () => void) => (
    <NestedCard
      size={nestedChildSize(host.size)}
      extent="head"
      depth={depth}
      hostDown={host.isDown}
      data={data}
      hostName={host.entityName}
      chassisName={host.chassisName}
      onCardClick={onCardClick}
      cardClickLabel={onCardClick ? `Open ${name}` : undefined}
    />
  )
  if (linkOut) {
    return (
      <a
        href={href}
        aria-label={`Open ${name}`}
        className={FOCUS_RING}
        style={{ color: 'inherit', display: 'block', textDecoration: 'none' }}
      >
        {row()}
      </a>
    )
  }
  return (
    <>
      {row(() => setOpen(true))}
      <EntityDetailDialog open={open} onOpenChange={setOpen} title={name}>
        <NestedCard data={data} chassisName={host.chassisName} />
      </EntityDetailDialog>
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
}: {
  label: string
  entities: ReferenceCardEntity[]
  seal?: { label: string; tone: string }
  sectionAs: ElementType | undefined
  host: NestedCardHost
}) {
  if (entities.length === 0) return null
  return (
    <CardTray label={label} count={entities.length} size={host.size} as={sectionAs}>
      <NestedCardList entities={entities} seal={seal} host={host} />
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
  if (drones.length === 0) return null
  return (
    <CardTray
      label={drones.length === 1 ? 'Drone' : 'Drones'}
      count={drones.length}
      size={host.size}
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

/**
 * The LEFT ANCHOR when there is no artwork: a prominent nested NPC (a crawler
 * bay's crew), floated so the body flows beside it.
 */
export function NpcAnchor({
  npcs,
  selections,
  onSelectionChange,
  hide,
  host,
}: {
  npcs: ReferenceCardEntity[]
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
          size={nestedChildSize(host.size)}
          depth={host.depth + 1}
          hostDown={host.isDown}
          data={npc}
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
