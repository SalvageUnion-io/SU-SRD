/**
 * CrewTab — the display's Crew tab: one read-only row per pilot in the Game,
 * from their seats (docs/architecture/dashboard-redesign.md D6, §8 A6).
 *
 * Each row says where the pilot is (on foot, or in which mech) and, live, the
 * deck action they are resolving: "Rook is resolving Crush", then the roll as
 * it lands. The row is a status, so it is announced politely as it changes.
 *
 * Crewmates' vitals, and the ▲ and red outline for someone who needs
 * attention, arrive with the server-derived crew status (plan layer 7).
 *
 * Presentational: `crewLines` builds the rows from what `useBoardSources`
 * already reads.
 */

import {
  borderWidth,
  color,
  font,
  fontSize,
  radius,
  space,
  tracking,
  weight,
} from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import type { CrewLine } from './useGameFeed'

const SCROLL: CSSProperties = { height: '100%', overflowY: 'auto', padding: space[12] }

const LIST: CSSProperties = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[6],
}

const ROW: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[2],
  padding: `${space[6]} ${space[8]}`,
  border: `${borderWidth.chrome} solid ${color.ink20}`,
  borderRadius: radius.card,
}

const WHO: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: space[8],
}

const NAME: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.sm,
  color: color.ink,
}

const WHERE: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.label,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink75,
}

const LIVE: CSSProperties = { fontFamily: font.body, fontSize: fontSize.note, color: color.ink }

const NOTE: CSSProperties = { ...LIVE, margin: 0, color: color.ink75 }

export function CrewTab({ crew }: { crew: CrewLine[] }) {
  if (crew.length === 0) {
    return (
      <div style={SCROLL}>
        <p style={NOTE}>The crew appears here once the Game's roster arrives.</p>
      </div>
    )
  }
  return (
    <div style={SCROLL}>
      <ul style={LIST}>
        {crew.map((c) => (
          <li key={c.pilotId} style={ROW}>
            <div style={WHO}>
              <span style={NAME}>{c.self ? `${c.name} (you)` : c.name}</span>
              <span style={WHERE}>{c.where}</span>
            </div>
            <span role="status" style={LIVE}>
              {c.resolving ?? ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
