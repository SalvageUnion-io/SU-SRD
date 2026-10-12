import type { CSSProperties } from 'react'
import { space } from '../../../design/tokens'
import { Badge } from '../../chrome/Badge'
import { Stat } from '../../shared/Stat'
import type { AxisMarker } from './entityCardTone'
import { UserMadeStamp } from './UserMadeStamp'

/** A stamp that gives way with "…" when the line runs out of room. */
const TRUNCATE = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

/** The line: the stamps on the left, the User-made stamp pushed to the right. */
const LINE: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  gap: space[6],
  minWidth: 0,
  width: '100%',
}

/**
 * The left cluster never runs past the band: on a phone the stamps share the
 * room and the last (the Legal Starting Pattern) gives way, instead of running
 * off the edge.
 */
const STAMPS: CSSProperties = {
  alignItems: 'center',
  display: 'flex',
  flex: '1 1 auto',
  gap: space[6],
  minWidth: 0,
  overflow: 'hidden',
}

const NO_WRAP: CSSProperties = { flex: 'none', whiteSpace: 'nowrap' }

/**
 * LABELS — the first line of an entity's head band, in flow above the title:
 * the TYPE stamp (every card, every depth — board E1), or a parent-provided
 * seal in its place; the classification pills; the Legal Starting Pattern
 * stamp; and on a user-made card the dashed User-made stamp at the right. On
 * the ink banner the stamps take the `inverse` plate so they still read.
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
  /** USER-MADE (ruleset §3.9): a dashed User-made stamp at the line's right. */
  userMade?: boolean
  /** The band is the ink banner (a thing you do). */
  onInk?: boolean
}) {
  const surface = onInk ? 'inverse' : 'on-ink'
  return (
    <div style={LINE}>
      <div style={STAMPS}>
        {/* A seal in ink is the standard stamp; any other tone keeps its own plate. */}
        {seal && (
          <Badge
            shape="stamp"
            size="mini"
            surface={surface}
            style={
              seal.tone === 'var(--color-ink)'
                ? NO_WRAP
                : { ...NO_WRAP, backgroundColor: seal.tone }
            }
          >
            {seal.label}
          </Badge>
        )}
        {typeStamp && (
          <Badge shape="stamp" size="mini" surface={surface} style={NO_WRAP}>
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
          <Badge shape="stamp" size="mini" surface={surface} style={TRUNCATE}>
            Legal Starting Pattern
          </Badge>
        )}
      </div>
      {/* The dashed stamp sits at the RIGHT end of the line (board P1), apart
          from the type stamp on the left. */}
      {userMade && (
        <span style={{ flex: 'none', marginLeft: 'auto' }}>
          <UserMadeStamp />
        </span>
      )}
    </div>
  )
}
