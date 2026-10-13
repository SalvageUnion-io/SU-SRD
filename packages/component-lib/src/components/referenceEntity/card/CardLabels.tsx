import { Badge } from '../../atoms/Badge'
import { Stat } from '../../atoms/Stat'
import type { AxisMarker } from './entityCardTone'
import { LEGAL_STARTING_PATTERN, LEGAL_STARTING_PATTERN_NOTE } from './legalStartingPattern'
import { UserMadeStamp } from './UserMadeStamp'

/*
 * The cluster's layout is `.su-ec-labels*` classes (`styles/index.css`), not
 * style objects: every head band of a listing carries one (ADR-046, repeated
 * elements).
 *
 * - `.su-ec-labels`: the stamps, then the User-made stamp.
 * - `__stamps`: they never run past the band; on a phone they share the room
 *   and the last (the Legal Starting Pattern) gives way instead of running
 *   off the edge.
 * - `__truncate`: a stamp that gives way with "…" when the line runs out.
 * - `__lead`: the type stamp (or the seal in its place) gives way LAST: it
 *   never shrinks, so the stamps after it go first, and only when it alone
 *   overflows does it truncate with "…" rather than being cut mid-letter.
 */
const LEAD = 'su-ec-labels__lead'

/**
 * LABELS — the categorization stamps of an entity's head band, on the title's
 * line, right of the name:
 * the TYPE stamp (every card, every depth — board E1), or a parent-provided
 * seal in its place; the classification pills; the Legal Starting Pattern
 * stamp; and on a user-made card the dashed User-made stamp after them. On
 * the ink banner the stamps take the `inverse` plate so they still read.
 * A pill whose label repeats the type stamp (a class's `[Class | Hybrid]`
 * after its "Class" stamp) stands in for the stamp: one `CLASS | HYBRID`,
 * never "CLASS" then "CLASS | HYBRID".
 */
export function CardLabels({
  seal,
  typeStamp,
  axisMarkers,
  legalStartingPattern,
  userMade = false,
  onInk = false,
}: {
  /** A parent-provided seal in place of the type stamp (GRANTS, CHASSIS ABILITY). */
  seal: { label: string; tone: string } | undefined
  /** The type stamp ("System", "Ability · Forging Tree"). */
  typeStamp: string | undefined
  axisMarkers: AxisMarker[]
  legalStartingPattern: boolean
  /** USER-MADE (ruleset §3.9): a dashed User-made stamp after the others. */
  userMade?: boolean
  /** The band is the ink banner (a thing you do). */
  onInk?: boolean
}) {
  const surface = onInk ? 'inverse' : 'on-ink'
  const restated =
    typeStamp !== undefined &&
    axisMarkers.some((marker) => marker.label.toLowerCase() === typeStamp.toLowerCase())
  return (
    <div className="su-ec-labels">
      <div className="su-ec-labels__stamps">
        {/* A seal in ink is the standard stamp; any other tone keeps its own plate. */}
        {seal && (
          <Badge
            shape="stamp"
            size="mini"
            surface={surface}
            className={LEAD}
            style={seal.tone === 'var(--color-ink)' ? undefined : { backgroundColor: seal.tone }}
          >
            {seal.label}
          </Badge>
        )}
        {typeStamp && !restated && (
          <Badge shape="stamp" size="mini" surface={surface} className={LEAD}>
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
            // A long value ("Chassis | Little Sestra") truncates with "…" on a
            // phone rather than being cut mid-word.
            truncate
          />
        ))}
        {/* A pattern the book sanctions as a starting loadout wears a stamp RIGHT
          of the `[Chassis | …]` marker. It sits in the head (not the body)
          precisely so it survives the LISTING extent. Purely the stored
          `legalStarting` data tag, never computed from tech level or SV. */}
        {legalStartingPattern && (
          <Badge
            shape="stamp"
            size="mini"
            surface={surface}
            className="su-ec-labels__truncate"
            title={LEGAL_STARTING_PATTERN_NOTE}
          >
            {LEGAL_STARTING_PATTERN}
          </Badge>
        )}
      </div>
      {/* The dashed stamp closes the cluster (board P1). */}
      {userMade && (
        <span style={{ flex: 'none' }}>
          <UserMadeStamp />
        </span>
      )}
    </div>
  )
}
