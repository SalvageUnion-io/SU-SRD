/**
 * PlayCrew — the Crew section of the Cockpit's right column (play.md §7),
 * Game only: one line per other seat at the table, each a Token one a line
 * (ruleset §1.3: Play's lists are Tokens), its chips what the table needs at
 * a glance: the mech aboard as a relation chip (`MECH | Atlas`, C11, R5;
 * "On foot" else), whether they are here ("Here", or "Away" once their seat
 * stops beating), and one vital: the one that needs looking at (▲, critical,
 * as `crewLines()` decides), else, while they are here, their SP aboard or HP
 * on foot.
 *
 * Tapping a line opens that crewmate's sheet read-only over Play
 * (`PlayCrewSheet`). What they are resolving is the Token's contentful body
 * while there is one (N3: plain words, no entity), announced politely as it
 * changes.
 *
 * Presentational over `crewSeatLines`: the caller hands in the crew read
 * (`crew.vitals`, through `useGameFeed`) and the seats.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { EmptyState, Entity, relation, Stat, tokens } from '../components/index'
import { unitRowModel } from '../lib/units/unitModel'
import type { BoardSources } from './boardMenu.model'
import type { CrewSeatLine } from './crew.model'
import { crewLineLabel, crewSeatLines } from './crew.model'
import { PlayCrewSheet } from './PlayCrewSheet'
import type { CrewVitals } from './useGameFeed'
import { usePresenceClock } from './usePresenceClock'

const RESOLVING = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  margin: 0,
} satisfies CSSProperties

type PlayCrewProps = {
  gameId: string
  /** The pilot this screen plays: left out of the list. */
  selfPilotId: string
  /** `crew.vitals`; null until it arrives. */
  crew: CrewVitals | null
  /** Every seat in the Game: what each crewmate is resolving. */
  seats: BoardSources['seats']
}

export function PlayCrew({ gameId, selfPilotId, crew, seats }: PlayCrewProps) {
  const now = usePresenceClock()
  const [open, setOpen] = useState<CrewSeatLine | null>(null)
  const lines = crewSeatLines(crew, seats, selfPilotId, now)

  return (
    <>
      {crew === null ? (
        <EmptyState variant="inline" body="The crew appears once the Game's roster arrives." />
      ) : lines.length === 0 ? (
        <EmptyState variant="inline" body="No one else is seated at this table yet." />
      ) : (
        <ul className="su-entity-token-list" aria-label="Crew" data-play-list="">
          {lines.map((line) => (
            <li key={line.pilotId}>
              <CrewLine line={line} onOpen={() => setOpen(line)} />
              <span role="status" className="su-sr-only">
                {line.resolving ?? ''}
              </span>
            </li>
          ))}
        </ul>
      )}
      <PlayCrewSheet
        gameId={gameId}
        pilotId={open?.pilotId ?? null}
        name={open?.name ?? ''}
        onClose={() => setOpen(null)}
      />
    </>
  )
}

function CrewLine({ line, onOpen }: { line: CrewSeatLine; onOpen: () => void }) {
  const { vital } = line
  return (
    <Entity
      form="token"
      context="roster"
      model={unitRowModel({ kind: 'pilot', name: line.name })}
      mode={{
        kind: 'link',
        onOpen,
        attrs: { 'aria-label': `${crewLineLabel(line)}. Open their sheet` },
      }}
      // The mech they are aboard is a relation chip (C11), never a stamp.
      {...(line.boardedIn === null
        ? {}
        : { relations: [relation('mech', 'Mech', line.boardedIn)] })}
      state={
        <>
          {line.boardedIn === null ? (
            <Stat orientation="horizontal" size="mini" label="On foot" />
          ) : null}
          <Stat orientation="horizontal" size="mini" label={line.present ? 'Here' : 'Away'} />
          {vital.attention ? (
            <Stat
              orientation="horizontal"
              size="mini"
              state="critical"
              label={`▲ ${vital.label}`}
              value={vital.value ?? undefined}
            />
          ) : line.present ? (
            <Stat
              orientation="horizontal"
              size="mini"
              surface="plain"
              label={vital.label}
              value={vital.value ?? undefined}
            />
          ) : null}
        </>
      }
      // What they are resolving, in words: the Token's body while there is one.
      {...(line.resolving
        ? { body: { text: false, children: <p style={RESOLVING}>{line.resolving}</p> } }
        : {})}
    />
  )
}
