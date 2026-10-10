import { cn } from '../../../utils/cn'
import { Badge } from '../../chrome/Badge'
import { STAMP_SEAM } from '../../chrome/stampSeam'
import { Stat } from '../../shared/Stat'
import type { AxisMarker } from './entityCardTone'
import { UserMadeStamp } from './UserMadeStamp'

/**
 * SEAM — the stamps riding the card's top border (ruleset §7.2): the TYPE
 * stamp (every card, every depth — board E1), or a parent-provided seal in its
 * place; the classification pills; the Legal Starting Pattern stamp; and on a
 * user-made card the dashed User-made stamp.
 */
export function CardSeam({
  seal,
  typeStamp,
  axisMarkers,
  legalStartingPattern,
  userMade = false,
}: {
  /** A parent-provided stampseal, in its own tone (e.g. GRANTS). */
  seal: { label: string; tone: string } | undefined
  /** The type stamp ("System", "Ability · Forging Tree"). */
  typeStamp: string | undefined
  axisMarkers: AxisMarker[]
  legalStartingPattern: boolean
  /** USER-MADE (ruleset §3.9): a dashed User-made stamp on the seam. */
  userMade?: boolean
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
        <Badge shape="stamp" size="mini" className="whitespace-nowrap">
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
          body) precisely so it survives the LISTING extent. Purely the stored
          `legalStarting` data tag, never computed from tech level or SV. */}
      {legalStartingPattern && (
        <Badge shape="stamp" size="mini" className="whitespace-nowrap">
          Legal Starting Pattern
        </Badge>
      )}
      {userMade && <UserMadeStamp />}
    </div>
  )
}
