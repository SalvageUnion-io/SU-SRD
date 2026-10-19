import type { ReactNode } from 'react'
import { Children, cloneElement, Fragment, isValidElement, useLayoutEffect, useRef } from 'react'
import { splitStatLine } from 'salvageunion-reference'
import { cn } from '../../../lib/cn'
import type { CSSVarStyle } from '../../../styles/cssVars'
import type { Size } from '../../../styles/sizing'
import { ActivationCost } from '../../atoms/ActivationCost'
import { Stat } from '../../atoms/Stat'
import { joinLanes } from './chipLanes'
import type { ChipClass, ChipSet } from './chipSet'
import { CHIP_CLASSES, costCell, RANK_KEY } from './chipSet'
import { Facts } from './Facts'
import { Tags } from './Tags'
import type { TagItem } from './tagItems'

/**
 * CHIPS — every chip strip (`chips-and-actions.md` C2a): a Token's, a Row's
 * or Card's head, a Page's band, a Tile's, a TitledBox's or Slab's summary.
 * ONE group (E17), in THE class order (C2): the host's marks (a note,
 * User-made, Suggested), the rank (`TL | 2`), the measures in the stat order
 * (`SLOTS | 1`, `SP | 12`), the economy (the action type, "Turn Action", then
 * the action's facts, `RNG | L`, `DMG | 4 SP`), the traits (`[Hot | 2]`,
 * linking to their entry where `linkable`), the relations (`PILOT |
 * Bonesaw`, C11), each the horizontal `Stat` cell, then the cost in the
 * book's pointy box (`CostBox`), the last read chip. The host's slots follow
 * it (C8): the state, the uses, the "⋯" menu. A form drops classes, never
 * reorders them.
 *
 * Each class is a LANE (`.su-chip-lane`, `data-chip-class`): `display:
 * contents` in a strip, so every chip is one flex item, the same gap from its
 * neighbours, groups included (owner, 2026-10-15). A lane carries how many
 * chips follow it (`--su-lane-end`), so a strip that fills from its
 * bottom-right corner orders its chips from the end (`--su-fill`). The group
 * wraps; it never clips a chip (E18).
 *
 * One look on every band: an action's chips on the ink banner are the same
 * plates, size and cost box as an entity's on its tone band. There (the
 * frame's `data-ground="ink"`, chrome K1, read in CSS) each cell only keeps a
 * paper rule, and the cost box its paper edge, so the ink halves do not sink
 * into the ink.
 */
export function Chips({
  chips,
  size,
  linkable = false,
  relationsLinkable = linkable,
  marks,
  state,
  uses,
  menu,
  nodes,
  align = 'start',
  as: Tag = 'div',
  lanes: inList = false,
  className,
}: {
  chips: ChipSet
  size: Size
  /** Traits may link (not inside a link or a clickable card). */
  linkable?: boolean
  /**
   * Relations may link: as traits by default; also where the form raises its
   * chips above a covering link (a Row's `data-covered`), so a unit's
   * `GAME | Rust Run` opens the Game while the Row opens the unit (C11).
   */
  relationsLinkable?: boolean
  /** The host's marks, first (a note, User-made, "Suggested"): one node per chip. */
  marks?: ReactNode
  /** The state slot after the cost (C8): a live reading, a condition, a quantity. */
  state?: ReactNode
  /** The uses slot. */
  uses?: ReactNode
  /** The last slot: the "⋯" menu, or ✕. */
  menu?: ReactNode
  /** The host's own chips of a class, after the model's of that class (a requirement, a relation). */
  nodes?: Partial<Record<ChipClass, ReactNode>>
  /** `end` packs the chips to the row's far end (a page's prose column). */
  align?: 'start' | 'end'
  /** A `span` where the strip sits in phrasing content (a Token's pill, a Tile's band). */
  as?: 'div' | 'span'
  /**
   * A line's strip in a list (a Row's or Token's head): every class keeps its
   * lane, empty or not, and the list sets each lane's width (`chipLanes.ts`,
   * C6), so a class is a column down the list.
   */
  lanes?: boolean
  className?: string
}) {
  const ref = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const strip = ref.current
    if (!inList || !strip) return
    return joinLanes(strip)
  }, [inList])
  const { stats, action } = splitStatLine(chips.facts)
  const rank = stats.filter((stat) => stat.key === RANK_KEY)
  const measure = stats.filter((stat) => stat.key !== RANK_KEY)
  const tags = (items: TagItem[] | undefined, key: string, links = linkable) =>
    items?.length ? [<Tags key={key} tags={items} linkable={links} size={size} />] : []
  // The model's chips by class, each node with how many chips it draws.
  const own: Record<ChipClass, { nodes: ReactNode[]; count: number }> = {
    mark: { nodes: [], count: 0 },
    rank: {
      nodes: rank.length ? [<Facts key="rank" cells={rank} size={size} />] : [],
      count: rank.length,
    },
    measure: {
      nodes: measure.length ? [<Facts key="measure" cells={measure} size={size} />] : [],
      count: measure.length,
    },
    economy: {
      nodes: [
        ...chips.durations.map((duration) => (
          <Stat key={duration} orientation="horizontal" label={duration} size={size} />
        )),
        ...(action.length ? [<Facts key="action" cells={action} size={size} />] : []),
      ],
      count: chips.durations.length + action.length,
    },
    traits: { nodes: tags(chips.tags, 'traits'), count: chips.tags.length },
    relation: {
      nodes: tags(chips.relations, 'relations', relationsLinkable),
      count: chips.relations?.length ?? 0,
    },
    cost: {
      nodes: chips.cost ? [<CostBox key="cost" cost={chips.cost} size={size} />] : [],
      count: chips.cost ? 1 : 0,
    },
    state: { nodes: [], count: 0 },
    uses: { nodes: [], count: 0 },
    menu: { nodes: [], count: 0 },
  }
  const host: Partial<Record<ChipClass, ReactNode>> = {
    ...nodes,
    mark: marks ?? nodes?.mark,
    state: state ?? nodes?.state,
    uses: uses ?? nodes?.uses,
    menu: menu ?? nodes?.menu,
  }
  const lanes = CHIP_CLASSES.map((cls) => {
    // A host's node is one chip; a Fragment is its children, each a chip, so
    // the lanes before it count what it draws (a Row's View and Unassign).
    const extra = chipNodes(host[cls])
    return { cls, nodes: [...own[cls].nodes, ...extra], count: own[cls].count + extra.length }
  })
  if (lanes.every((lane) => lane.nodes.length === 0)) return null
  return (
    <Tag
      ref={ref as never}
      data-chip-group=""
      data-lanes={inList || undefined}
      className={cn('su-chips', align === 'end' && 'su-chips--end', className)}
    >
      {lanes.map((lane, index) =>
        lane.nodes.length === 0 && !inList ? null : (
          <span
            key={lane.cls}
            className="su-chip-lane"
            data-chip-class={lane.cls}
            style={laneEnd(lanes.slice(index + 1).map((after) => after.count))}
          >
            {lane.nodes}
          </span>
        )
      )}
    </Tag>
  )
}

/**
 * A host's nodes as its chips: arrays and Fragments opened, each child one
 * chip, its key prefixed with its Fragment's so two Fragments never collide.
 */
function chipNodes(node: ReactNode, prefix = ''): ReactNode[] {
  return Children.toArray(node).flatMap((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return [child]
    if (child.type === Fragment) return chipNodes(child.props.children, `${prefix}${child.key}/`)
    return [prefix ? cloneElement(child, { key: `${prefix}${child.key}` }) : child]
  })
}

/** How many chips follow a lane: where its own chips count from, from the strip's end. */
function laneEnd(after: readonly number[]): CSSVarStyle {
  return { '--su-lane-end': after.reduce((sum, n) => sum + n, 0) }
}

/**
 * A read cost ("2 EP") as the book prints it, the one chip that leads with its value: the ink pointy box
 * (`ActivationCost`), with a paper edge on an ink ground. Every form's read cost is this box,
 * last among its chips.
 */
function CostBox({ cost, size }: { cost: string; size: Size }) {
  const cell = costCell(cost)
  return (
    <ActivationCost
      cost={cell.value ?? cell.label}
      currency={cell.value ? cell.label : ''}
      compact={size !== 'full'}
      mini={size === 'mini'}
    />
  )
}
