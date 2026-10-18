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
 * - `__stamps`: short of room they wrap onto a second line; no stamp is ever
 *   cut to "…" (entity display language E18).
 * - `__truncate` / `__lead`: a stamp that keeps its whole word (the Legal
 *   Starting Pattern; the seal or the caller's note).
 */
const LEAD = 'su-ec-labels__lead'

/**
 * LABELS — the stamps of an entity's head band that say something the band
 * does not, on the title's line, right of the name: a parent-provided seal
 * (GRANTS, CHASSIS ABILITY) or a caller's note ("From Veteran"); the
 * classification pills (`[Class | Hybrid]`, `[Chassis | Mule]`); the Legal
 * Starting Pattern stamp; and on a user-made card the dashed User-made stamp
 * after them. Never the entity's kind: no form stamps that (E9), the title
 * says it to screen readers (`KindLabel`). On an ink ground (the band's
 * `data-ground`, chrome K1) the stamps take the paper plate, in CSS, so they
 * still read.
 */
export function CardLabels({
  seal,
  note,
  axisMarkers,
  legalStartingPattern,
  userMade = false,
}: {
  /** A parent-provided seal (GRANTS, CHASSIS ABILITY). */
  seal: { label: string; tone: string } | undefined
  /** A caller's note that says more than the kind ("From Veteran", "Crawler crew · Med Bay"). */
  note?: string
  axisMarkers: AxisMarker[]
  legalStartingPattern: boolean
  /** USER-MADE (ruleset §3.9): a dashed User-made stamp after the others. */
  userMade?: boolean
}) {
  if (!seal && !note && axisMarkers.length === 0 && !legalStartingPattern && !userMade) return null
  return (
    <div className="su-ec-labels">
      <div className="su-ec-labels__stamps">
        {/* A seal in ink is the standard stamp; any other tone keeps its own plate. */}
        {seal && (
          <Badge
            shape="stamp"
            size="mini"
            className={LEAD}
            style={seal.tone === 'var(--color-ink)' ? undefined : { backgroundColor: seal.tone }}
          >
            {seal.label}
          </Badge>
        )}
        {note && (
          <Badge shape="stamp" size="mini" className={LEAD}>
            {note}
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
        {/* A pattern the book sanctions as a starting loadout wears a stamp RIGHT
          of the `[Chassis | …]` marker. It sits in the head (not the body)
          precisely so it survives the LISTING extent. Purely the stored
          `legalStarting` data tag, never computed from tech level or SV. */}
        {legalStartingPattern && (
          <Badge
            shape="stamp"
            size="mini"
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
