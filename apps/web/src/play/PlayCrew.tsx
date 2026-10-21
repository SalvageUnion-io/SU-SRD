/**
 * PlayCrew — the Crew section of the Cockpit's right column (play.md §7),
 * Game only: one Mini per other seat at the table, in the Mini grid
 * (`MiniGrid`; ruleset §1.3: Play's lists are Minis), its Mini chips what
 * the table needs at a glance: the mech aboard as a relation chip (`MECH | Atlas`, C11, R5;
 * "On foot" else), whether they are here ("Here", or "Away" once their seat
 * stops beating), and one vital: the one that needs looking at (▲, critical,
 * as `crewLines()` decides), else, while they are here, their SP aboard or HP
 * on foot.
 *
 * Tapping a line opens that crewmate's sheet read-only over Play
 * (`PlayCrewSheet`). What they are resolving is the Mini's contentful body
 * while there is one (N3: plain words, no entity), announced politely as it
 * changes.
 *
 * Presentational over `crewSeatLines`: the caller hands in the crew read
 * (`crew.vitals`, through `useGameFeed`) and the seats.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { EmptyState, Entity, MiniGrid, Stat, tokens } from '../components/index'
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
        <MiniGrid label="Crew" play>
          {lines.map((line) => (
            <li key={line.pilotId}>
              <CrewLine line={line} onOpen={() => setOpen(line)} />
              <span role="status" className="su-sr-only">
                {line.resolving ?? ''}
              </span>
            </li>
          ))}
        </MiniGrid>
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
      size="mini"
      context="roster"
      model={unitRowModel({ kind: 'pilot', name: line.name })}
      mode={{
        kind: 'link',
        onOpen,
        attrs: { 'aria-label': `${crewLineLabel(line)}. Open their sheet` },
      }}
      // The mech they are aboard, its header-only Mini in the line's body,
      // never a chip (owner, round 4).
      {...(line.boardedIn === null
        ? {}
        : { linked: [{ key: 'mech', kind: 'mech' as const, name: line.boardedIn }] })}
      state={
        <>
          {line.boardedIn === null ? <Stat size="mini" label="On foot" /> : null}
          <Stat size="mini" label={line.present ? 'Here' : 'Away'} />
          {vital.attention ? (
            <Stat
              size="mini"
              state="critical"
              label={`▲ ${vital.label}`}
              value={vital.value ?? undefined}
            />
          ) : line.present ? (
            <Stat
              size="mini"
              surface="plain"
              label={vital.label}
              value={vital.value ?? undefined}
            />
          ) : null}
        </>
      }
      // What they are resolving, in words: the Mini's body while there is one.
      {...(line.resolving
        ? { body: { text: false, children: <p style={RESOLVING}>{line.resolving}</p> } }
        : {})}
    />
  )
}
