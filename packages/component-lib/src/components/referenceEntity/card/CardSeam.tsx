import type { CSSProperties } from 'react'
import { space } from '../../../design/tokens'
import { Badge } from '../../chrome/Badge'
import { STAMP_SEAM } from '../../chrome/stampSeam'
import { Stat } from '../../shared/Stat'
import type { AxisMarker } from './entityCardTone'
import { UserMadeStamp } from './UserMadeStamp'

/** A stamp that gives way with "…" when the seam runs out of room. */
const TRUNCATE = {
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} satisfies CSSProperties

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
    <>
      <div
        className={STAMP_SEAM}
        // Never wider than the card: on a phone the stamps share the room and the
        // last (the Legal Starting Pattern) gives way, instead of running off the
        // edge. `clip` on x only, so the stamps still ride above the frame.
        style={{
          left: '15px',
          display: 'flex',
          alignItems: 'center',
          gap: space[6],
          maxWidth: 'calc(100% - 30px)',
          overflowX: 'clip',
        }}
      >
        {/* The seal is the type stamp's own atom, in the parent's tone. */}
        {seal && (
          <Badge
            shape="stamp"
            size="mini"
            style={{ backgroundColor: seal.tone, whiteSpace: 'nowrap' }}
          >
            {seal.label}
          </Badge>
        )}
        {typeStamp && (
          <Badge shape="stamp" size="mini" style={{ whiteSpace: 'nowrap' }}>
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
            // phone rather than being cut mid-word by the seam's clip.
            truncate
          />
        ))}
        {/* A pattern the book sanctions as a starting loadout wears a stamp on the
          seam, RIGHT of the `[Chassis | …]` marker. It rides the seam (not the
          body) precisely so it survives the LISTING extent. Purely the stored
          `legalStarting` data tag, never computed from tech level or SV. */}
        {legalStartingPattern && (
          <Badge shape="stamp" size="mini" style={TRUNCATE}>
            Legal Starting Pattern
          </Badge>
        )}
      </div>
      {/* The dashed stamp rides the RIGHT end of the seam (board P1), apart from
          the type stamp on the left. */}
      {userMade && (
        <div
          className={STAMP_SEAM}
          style={{ right: '15px', display: 'flex', alignItems: 'center' }}
        >
          <UserMadeStamp />
        </div>
      )}
    </>
  )
}
