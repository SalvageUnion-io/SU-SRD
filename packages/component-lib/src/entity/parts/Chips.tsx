import type { ReactNode } from 'react'
import { Stat } from '../../components/atoms/Stat'
import type { SizeRung } from '../../styles/sizing'
import { cn } from '../../utils/cn'
import type { ChipSet } from './chipSet'
import { chipCount, costCell } from './chipSet'
import { Facts } from './Facts'
import { Tags } from './Tags'

/**
 * CHIPS — every chip of an entity as ONE group in ONE style (E17): the action
 * type ("Turn Action"), the cost (`EP | 2`), the facts (`SLOTS | 1`,
 * `RNG | Long`), then the traits (`[Hot | 2]`, linking to their entry where
 * `linkable`), each the horizontal `Stat` cell. The group wraps; it never
 * clips a chip (E18).
 *
 * On the ink banner (`onInk`) the cells take the inverse plate, and
 * `.su-chips--on-ink` keeps a paper rule round each so its value cell does
 * not sink into the ink.
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
  const cost = chips.cost ? costCell(chips.cost) : undefined
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
        <Stat
          key={duration}
          orientation="horizontal"
          label={duration}
          size={rung}
          inverse={onInk}
        />
      ))}
      {cost && (
        <Stat
          orientation="horizontal"
          label={cost.label}
          value={cost.value}
          size={rung}
          inverse={onInk}
        />
      )}
      <Facts cells={chips.facts} size={rung} inverse={onInk} />
      <Tags tags={chips.tags} linkable={linkable} rung={rung} onInk={onInk} />
    </div>
  )
}
