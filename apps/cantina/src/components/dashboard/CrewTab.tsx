/**
 * CrewTab — the display's Crew tab: the crew as Rows, one per crewmate, pilot
 * first (ADR-038 §4; board D2), drawn as every crew list draws them
 * (`CrewRow`): the pilot's HP and AP as label-first chips, their mech as a
 * Token, and their status — "Fine", or what is wrong after a ▲. A crewmate
 * who is dead, injured or ejected, or whose mech is destroyed or
 * overheating, gets an outline and the ▲ word; never a second hue for the
 * row. The Crew tab itself carries a ▲ (`DisplayTabs`). Those verdicts are
 * the server's (`crew.vitals`), so every client at the table flags the same
 * people.
 *
 * Each Row opens that crewmate's live sheet, read-only when it is not yours.
 * The action they are resolving ("Rook is resolving Crush", then the roll as
 * it lands) sits under the row, announced politely as it changes.
 *
 * Under the list, the Organizer gets "Copy invite link" (`CopyInviteLink`),
 * the Game's one invite URL.
 *
 * Presentational: `crewLines` builds the rows from `crew.vitals` and the seats.
 * Style objects only, no new `.su-dash-*` class (ADR-046).
 */

import { color, font, fontSize, space } from 'component-lib/design/tokens'
import type { CSSProperties } from 'react'
import type { Id } from '../../../convex/_generated/dataModel'
import { CopyInviteLink } from '../games/CopyInviteLink'
import { CrewRow } from './CrewRow'
import { crewProblem } from './crewProblem.model'
import type { CrewLine } from './useGameFeed'

const SCROLL = {
  height: '100%',
  overflowY: 'auto',
  padding: space[12],
  display: 'flex',
  flexDirection: 'column',
  gap: space[8],
} satisfies CSSProperties

const LIST = {
  listStyle: 'none',
  margin: 0,
  padding: 0,
  display: 'flex',
  flexDirection: 'column',
  gap: space[12],
} satisfies CSSProperties

const TEXT = {
  fontFamily: font.body,
  fontSize: fontSize.caption,
  color: color.ink,
  fontVariantNumeric: 'tabular-nums',
} satisfies CSSProperties

const RESOLVING = { ...TEXT, paddingInline: space[2] } satisfies CSSProperties

const FOOT = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  flexWrap: 'wrap',
  gap: space[12],
  marginTop: 'auto',
  paddingTop: space[8],
} satisfies CSSProperties

const NOTE = {
  ...TEXT,
  margin: 0,
  color: color.ink75,
  fontSize: fontSize.note,
} satisfies CSSProperties

type CrewTabProps = {
  crew: CrewLine[]
  /** The Game, for "Copy invite link"; null outside one or for anyone but its Organizer. */
  gameId: Id<'games'> | null
}

export function CrewTab({ crew, gameId }: CrewTabProps) {
  return (
    <div style={SCROLL}>
      {crew.length === 0 ? (
        <p style={NOTE}>The crew appears here once the Game's roster arrives.</p>
      ) : (
        <ul style={LIST} aria-label="Crew">
          {crew.map((c) => (
            <li key={c.pilotId}>
              <CrewRow
                line={c}
                mode={{
                  kind: 'link',
                  href: c.href,
                  // The chips are labelled; the name says the whole line to a
                  // screen reader in one go.
                  attrs: {
                    'aria-label': `${c.self ? `${c.name} (you)` : c.name}: HP ${c.hp}, AP ${c.ap}, ${c.unit}, ${crewProblem(c) ?? 'Fine'}`,
                  },
                }}
                after={
                  c.resolving ? (
                    <span role="status" style={RESOLVING}>
                      {c.resolving}
                    </span>
                  ) : (
                    <span role="status" />
                  )
                }
              />
            </li>
          ))}
        </ul>
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
