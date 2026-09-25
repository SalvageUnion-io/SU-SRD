import { cn } from '../../../utils/cn'
import { Badge } from '../../chrome/Badge'
import { STAMP_SEAM } from '../../chrome/stampSeam'
import { Stat } from '../../shared/Stat'
import type { AxisMarker } from './entityCardTone'

/**
 * SEAM — the stamps riding the card's top border: a parent-provided seal, the
 * type stamp (nested cards only), the classification axis pills, and the
 * Legal Starting Pattern stamp.
 */
export function CardSeam({
  seal,
  typeStamp,
  axisMarkers,
  legalStartingPattern,
}: {
  /** A parent-provided stampseal, in its own tone (e.g. GRANTS). */
  seal: { label: string; tone: string } | undefined
  /** The schema-type stamp, already gated to the cards that show it. */
  typeStamp: string | undefined
  axisMarkers: AxisMarker[]
  legalStartingPattern: boolean
}) {
  return (
    <div className={cn(STAMP_SEAM, 'left-[15px] flex items-center gap-1.5')}>
      {seal && (
        <span
          className="inline-block w-fit border border-ink px-1 py-0.5 font-cond text-badge font-bold uppercase leading-none tracking-caps-tight text-paper"
          style={{ backgroundColor: seal.tone, lineHeight: 1 }}
        >
          {seal.label}
        </span>
      )}
      {typeStamp && (
        <Badge shape="stamp" size="mini">
          {typeStamp}
        </Badge>
      )}
      {axisMarkers.map((marker) => (
        <Stat
          key={marker.label}
          orientation="horizontal"
          label={marker.label}
          value={marker.value}
          size="mini"
        />
      ))}
      {/* A pattern the book sanctions as a starting loadout wears a stamp on the
          seam, RIGHT of the `[Chassis | …]` marker. It rides the seam (not the
          body) precisely so it survives the LISTING extent — the pattern rows
          under a chassis render header-only, and that is where a reader picking
          a starting mech is actually looking. Purely the stored `legalStarting`
          data tag, never computed from tech level or salvage value. */}
      {legalStartingPattern && (
        <Badge shape="stamp" size="mini" className="whitespace-nowrap">
          Legal Starting Pattern
        </Badge>
      )}
    </div>
  )
}
