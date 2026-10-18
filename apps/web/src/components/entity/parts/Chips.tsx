import type { ReactNode } from 'react'
import { splitStatLine } from 'salvageunion-reference'
import { cn } from '../../../lib/cn'
import type { Size } from '../../../styles/sizing'
import { ActivationCost } from '../../atoms/ActivationCost'
import { Stat } from '../../atoms/Stat'
import type { ChipSet } from './chipSet'
import { chipCount, costCell } from './chipSet'
import { Facts } from './Facts'
import { Tags } from './Tags'

/**
 * CHIPS — every chip of an entity as ONE group (E17), in THE stat order
 * (`STATS`, salvageunion-reference): the stats (`TL | 2`, `SLOTS | 1`,
 * `SP | 12`), the action type ("Turn Action") and the action's facts
 * (`RNG | L`, `DMG | 4 SP`), the traits (`[Hot | 2]`, linking to their entry
 * where `linkable`), the relations (`PILOT | Bonesaw`, C11), each the
 * horizontal `Stat` cell, then last the cost in
 * the book's pointy box (`CostBox`). Every chip sits the same gap from its
 * neighbours, groups included (owner, 2026-10-15). The group wraps; it never
 * clips a chip (E18).
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
  leading,
  trailing,
  align = 'start',
  className,
}: {
  chips: ChipSet
  size: Size
  /** Traits may link (not inside a link or a clickable card). */
  linkable?: boolean
  /** A stamp the context leads with ("Suggested"). */
  leading?: ReactNode
  /** The host's last chip (a Row's "⋯" menu), after the cost. */
  trailing?: ReactNode
  /** `end` packs the chips to the row's far end (a page's prose column). */
  align?: 'start' | 'end'
  className?: string
}) {
  if (!leading && !trailing && chipCount(chips) === 0) return null
  const { stats, action } = splitStatLine(chips.facts)
  return (
    <div
      data-chip-group=""
      className={cn('su-chips', align === 'end' && 'su-chips--end', className)}
    >
      {leading}
      <Facts cells={stats} size={size} />
      {chips.durations.map((duration) => (
        <Stat key={duration} orientation="horizontal" label={duration} size={size} />
      ))}
      <Facts cells={action} size={size} />
      <Tags tags={chips.tags} linkable={linkable} size={size} />
      {chips.relations && <Tags tags={chips.relations} linkable={linkable} size={size} />}
      {chips.cost && <CostBox cost={chips.cost} size={size} />}
      {trailing}
    </div>
  )
}

/**
 * A read cost ("2 EP") as the book prints it, the one chip that leads with its value: the ink pointy box
 * (`ActivationCost`), with a paper edge on an ink ground. Every form's read cost is this box,
 * last among its chips.
 */
export function CostBox({ cost, size }: { cost: string; size: Size }) {
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
