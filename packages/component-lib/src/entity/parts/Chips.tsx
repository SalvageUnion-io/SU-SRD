import type { ReactNode } from 'react'
import { ActivationCost } from '../../components/atoms/ActivationCost'
import { Stat } from '../../components/atoms/Stat'
import type { SizeRung } from '../../styles/sizing'
import { cn } from '../../utils/cn'
import type { ChipSet } from './chipSet'
import { chipCount, costCell } from './chipSet'
import { Facts } from './Facts'
import { Tags } from './Tags'

/**
 * CHIPS — every chip of an entity as ONE group (E17): the action type
 * ("Turn Action"), the facts (`SLOTS | 1`, `RNG | Long`), the traits
 * (`[Hot | 2]`, linking to their entry where `linkable`), each the horizontal
 * `Stat` cell, then last the cost in the book's pointy box (`CostBox`). The
 * group wraps; it never clips a chip (E18).
 *
 * One look on every band: an action's chips on the ink banner are the same
 * plates, rung and cost box as an entity's on its tone band. There
 * (`onInk`) `.su-chips--on-ink` only keeps a paper rule round each cell, and
 * the cost box its paper edge, so the ink halves do not sink into the ink.
 */
export function Chips({
  chips,
  rung,
  onInk = false,
  linkable = false,
  leading,
  align = 'start',
  className,
}: {
  chips: ChipSet
  rung: SizeRung
  onInk?: boolean
  /** Traits may link (not inside a link or a clickable card). */
  linkable?: boolean
  /** A stamp the context leads with ("Suggested"). */
  leading?: ReactNode
  /** `end` packs the chips to the row's far end (a page's prose column). */
  align?: 'start' | 'end'
  className?: string
}) {
  if (!leading && chipCount(chips) === 0) return null
  return (
    <div
      data-chip-group=""
      className={cn(
        'su-chips',
        onInk && 'su-chips--on-ink',
        align === 'end' && 'su-chips--end',
        className
      )}
    >
      {leading}
      {chips.durations.map((duration) => (
        <Stat key={duration} orientation="horizontal" label={duration} size={rung} />
      ))}
      <Facts cells={chips.facts} size={rung} />
      <Tags tags={chips.tags} linkable={linkable} rung={rung} />
      {chips.cost && <CostBox cost={chips.cost} rung={rung} onInk={onInk} />}
    </div>
  )
}

/**
 * A read cost ("2 EP") as the book prints it, the one chip that leads with its value: the ink pointy box
 * (`ActivationCost`), with a paper edge on an ink band. Every form's read cost is this box,
 * last among its chips; the Dashboard's pennant button is the live one.
 */
export function CostBox({
  cost,
  rung,
  onInk = false,
}: {
  cost: string
  rung: SizeRung
  onInk?: boolean
}) {
  const cell = costCell(cost)
  return (
    <ActivationCost
      cost={cell.value ?? cell.label}
      currency={cell.value ? cell.label : ''}
      compact={rung !== 'full'}
      mini={rung === 'mini'}
      onInk={onInk}
    />
  )
}
