/**
 * CrewTab — the display's Crew tab: the crew as a table, one read-only row per
 * crewmate, pilot first (ADR-038 §4; board D2, issue 1255).
 *
 * Columns: the pilot, their HP and AP, where they are and in what (Mech), and
 * their status — "Fine", or what is wrong after a ▲. A crewmate who is dead,
 * injured or ejected, or whose mech is destroyed or overheating, gets an
 * outline and the ▲ word; never a second hue for the row. The Crew tab itself
 * carries a ▲ (`DisplayTabs`). Those verdicts are the server's (`crew.vitals`),
 * so every client at the table flags the same people.
 *
 * Tapping a row opens that crewmate's live sheet, read-only when it is not
 * yours. The action they are resolving ("Rook is resolving Crush", then the
 * roll as it lands) sits under the row, announced politely as it changes.
 *
 * Under the table, "Copy invite link" brings someone else to the table
 * (`CopyInviteLink`): the Organizer's link opens the door, anyone else's asks
 * the Organizer.
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
import type { Id } from '../../../convex/_generated/dataModel'
import { CopyInviteLink } from '../games/CopyInviteLink'
import { AppLink } from '../shared/AppLink'
import type { CrewLine } from './useGameFeed'

const SCROLL: CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  padding: space[12],
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
}

/** Pilot · HP · AP · Mech · Status (board D2). */
const COLUMNS = 'minmax(0, 1.4fr) 0.9fr 0.9fr minmax(0, 2.2fr) minmax(0, 2.6fr)'

const HEAD: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  gap: space[12],
  padding: `0 ${space[12]}`,
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.badge,
  letterSpacing: tracking.caps,
  textTransform: 'uppercase',
  color: color.ink75,
}

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
  border: `${borderWidth.chrome} solid ${color.ink20}`,
  borderRadius: radius.card,
  background: color.paper,
}

/**
 * The outline is the "look here" signal, drawn as an inset ring so the row
 * never changes size when it appears.
 */
const ROW_ATTENTION: CSSProperties = {
  ...ROW,
  borderColor: color.statusBad,
  boxShadow: `inset 0 0 0 1px ${color.statusBad}`,
}

/** The tappable part of a row: everything but the live resolve. */
const LINK: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  gap: space[12],
  minHeight: '44px',
  padding: `${space[6]} ${space[12]}`,
  color: 'inherit',
  textDecoration: 'none',
}

const NAME: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.lede,
  letterSpacing: tracking.capsTight,
  textTransform: 'uppercase',
  color: color.ink,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}

const NUMBER: CSSProperties = {
  fontFamily: font.cond,
  fontWeight: weight.bold,
  fontSize: fontSize.lede,
  fontVariantNumeric: 'tabular-nums',
  color: color.ink,
}

const TEXT: CSSProperties = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink,
  fontVariantNumeric: 'tabular-nums',
}

const PROBLEM: CSSProperties = { ...TEXT, fontWeight: weight.bold }

/** The ▲ is the one mark in the bad hue; the words stay ink. */
const MARK: CSSProperties = { color: color.statusBad }

const RESOLVING: CSSProperties = { ...TEXT, padding: `0 ${space[12]} ${space[6]}` }

const FOOT: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: space[12],
  marginTop: 'auto',
  paddingTop: space[8],
}

const NOTE: CSSProperties = { ...TEXT, margin: 0, color: color.ink75, fontSize: fontSize.note }

/** What is wrong, in words, or "Fine". A parked mech's trouble is its own line. */
function status(c: CrewLine): string | null {
  if (c.problems.length > 0) return c.problems.join(' · ')
  if (c.mechAttention && c.mech) return c.mech
  return null
}

type CrewTabProps = {
  crew: CrewLine[]
  /** The Game, for "Copy invite link"; null outside one. */
  gameId: Id<'games'> | null
}

export function CrewTab({ crew, gameId }: CrewTabProps) {
  return (
    <div style={SCROLL}>
      {crew.length === 0 ? (
        <p style={NOTE}>The crew appears here once the Game's roster arrives.</p>
      ) : (
        <>
          <div style={HEAD} aria-hidden="true">
            <span>Pilot</span>
            <span>HP</span>
            <span>AP</span>
            <span>Mech</span>
            <span>Status</span>
          </div>
          <ul style={LIST} aria-label="Crew">
            {crew.map((c) => {
              const problem = status(c)
              return (
                <li key={c.pilotId} style={c.attention ? ROW_ATTENTION : ROW}>
                  <AppLink
                    href={c.href}
                    className="su-focus-ring"
                    style={LINK}
                    // The columns are a grid of bare numbers: the name says
                    // which number is which.
                    aria-label={`${c.self ? `${c.name} (you)` : c.name}: HP ${c.hp}, AP ${c.ap}, ${c.unit}, ${problem ?? 'Fine'}`}
                  >
                    <span style={NAME}>{c.self ? `${c.name} (you)` : c.name}</span>
                    <span style={NUMBER}>{c.hp}</span>
                    <span style={NUMBER}>{c.ap}</span>
                    <span style={TEXT}>{c.unit}</span>
                    {problem === null ? (
                      <span style={TEXT}>Fine</span>
                    ) : (
                      <span style={PROBLEM}>
                        <span style={MARK} aria-hidden="true">
                          ▲{' '}
                        </span>
                        {problem}
                      </span>
                    )}
                  </AppLink>
                  {c.resolving ? (
                    <span role="status" style={RESOLVING}>
                      {c.resolving}
                    </span>
                  ) : (
                    <span role="status" />
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
      <div style={FOOT}>
        <p style={NOTE}>
          Read-only. Problems take an outline and a ▲ word, never a second hue. A crewmate's state
          is theirs to change.
        </p>
        {gameId !== null && <CopyInviteLink gameId={gameId} />}
      </div>
    </div>
  )
}
