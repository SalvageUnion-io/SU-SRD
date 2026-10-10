/**
 * CrewTab — the display's Crew tab: one read-only row per crewmate, pilot first
 * (ADR-038 §4).
 *
 * Each row shows the pilot's HP and AP, and where they are. Boarded, their
 * mech's SP and Heat follow; on foot, the mech assigned to them is one line,
 * parked. A crewmate who is dead, injured or ejected, or whose mech is
 * destroyed or overheating, gets a red outline and their problems in red; the
 * Crew tab itself carries a ▲ (`DisplayTabs`). Those verdicts are the server's
 * (`crew.vitals`), so every client at the table flags the same people.
 *
 * Tapping a row opens that crewmate's live sheet, read-only when it is not
 * yours. The action they are resolving ("Rook is resolving Crush", then the
 * roll as it lands) sits under the row, announced politely as it changes.
 *
 * Presentational: `crewLines` builds the rows from `crew.vitals` and the seats.
 * Style objects only, no new `.pc-*` class (tailwind-removal.md §4).
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
import { AppLink } from '../shared/AppLink'
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

/**
 * The red outline is the "look here" signal, drawn as an inset ring so
 * the row never changes size when it appears.
 */
const ROW_ATTENTION: CSSProperties = {
  ...ROW,
  borderColor: color.statusBad,
  boxShadow: `inset 0 0 0 1px ${color.statusBad}`,
}

/** The tappable part of a row: everything but the live resolve. */
const LINK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: space[2],
  color: 'inherit',
  textDecoration: 'none',
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
  fontSize: fontSize.badge,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink75,
}

const TEXT: CSSProperties = {
  fontFamily: font.body,
  fontSize: fontSize.note,
  color: color.ink,
  fontVariantNumeric: 'tabular-nums',
}

const PROBLEM: CSSProperties = { ...TEXT, color: color.statusBad, fontWeight: weight.bold }

const NOTE: CSSProperties = { ...TEXT, margin: 0, color: color.ink75 }

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
          <li key={c.pilotId} style={c.attention ? ROW_ATTENTION : ROW}>
            <AppLink href={c.href} className="su-focus-ring" style={LINK}>
              <span style={WHO}>
                <span style={NAME}>{c.self ? `${c.name} (you)` : c.name}</span>
                <span style={WHERE}>{c.where}</span>
              </span>
              <span style={TEXT}>{c.vitals}</span>
              {c.mech ? <span style={c.mechAttention ? PROBLEM : TEXT}>{c.mech}</span> : null}
              {c.problems.length > 0 ? <span style={PROBLEM}>{c.problems.join(' · ')}</span> : null}
            </AppLink>
            <span role="status" style={TEXT}>
              {c.resolving ?? ''}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
