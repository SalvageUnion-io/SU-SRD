import type { Size } from '../../../styles/sizing'
import { Stat } from '../../atoms/Stat'
import type { StatItem } from '../../containers/statsBarTypes'
import { factRef } from './factRefs'
import { statTerm } from './statTerms'
import { ChipLink } from './Tags'
import { TermChip } from './TermChip'

/**
 * FACTS — the body's first cells: each a horizontal `Stat` at its `full`
 * rung, the row's content. An editable stat (a sheet's override) grows its
 * stepper, exactly as the card's cluster does. A catalog CompactIndex sets its cells a
 * rung down (`compact`), under the art. A value longer than the row is wide (a
 * hybrid class's requirements in an index Compact) wraps onto more lines instead of
 * being clipped by the frame (`wrap`).
 */
export function Facts({
  cells,
  size = 'compact',
  linkable = false,
}: {
  cells: StatItem[]
  size?: Size
  /** A read fact that names a rule (`factRef`: TL, RNG, SV) links to it, as a trait does. */
  linkable?: boolean
}) {
  return (
    <>
      {cells.map((stat) => {
        const ref = linkable && !stat.onChange ? factRef(stat) : undefined
        const cell = (
          <Stat
            key={stat.key}
            label={stat.label}
            value={stat.value}
            bottomLabel={stat.bottomLabel}
            shortLabel={stat.shortLabel}
            size={size}
            state={stat.state}
            onChange={stat.onChange}
            mode={stat.onChange ? ((stat.canEdit ?? true) ? 'edit' : 'read') : 'read'}
            max={stat.outOfMax}
            hoverText={stat.hoverText}
            wrap
          />
        )
        // A stat with no glossary entry is defined in place (Cargo Capacity,
        // Slots Required, DMG): its chip opens the meaning (E27).
        const term = linkable && !ref && !stat.onChange ? statTerm(stat) : undefined
        if (term)
          return (
            <TermChip key={stat.key} term={term} value={String(stat.value)}>
              {cell}
            </TermChip>
          )
        if (!ref) return cell
        const name = stat.shortLabel ?? stat.label
        return (
          <ChipLink
            key={stat.key}
            tag={{ key: stat.key, name, param: String(stat.value), ref }}
            linkable
          >
            {cell}
          </ChipLink>
        )
      })}
    </>
  )
}
