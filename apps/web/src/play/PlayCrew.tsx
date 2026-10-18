/**
 * PlayCrew — the Crew section of the Cockpit's right column (play.md §7),
 * Game only: one line per other seat at the table, each a compact Row (level
 * 1, play.md §12) with a presence dot, the callsign, the mount as a chip
 * ("Boarded · Atlas", "On foot") and one vital: the one that needs looking at
 * (▲ and the red frame, as `crewLines()` decides), else their SP aboard or HP
 * on foot. A crewmate whose seat has stopped beating reads "away".
 *
 * Tapping a line opens that crewmate's sheet read-only over Play
 * (`PlayCrewSheet`). What they are resolving sits under their line,
 * announced politely as it changes.
 *
 * Presentational over `crewSeatLines`: the caller hands in the crew read
 * (`crew.vitals`, through `useGameFeed`) and the seats.
 */

import type { CSSProperties } from 'react'
import { useState } from 'react'
import { unitRowModel } from '../../lib/units/unitModel'
import { EmptyState, Entity, Stat, tokens } from '../index'
import type { BoardSources } from './boardMenu.model'
import type { CrewSeatLine } from './crew.model'
import { crewLineLabel, crewSeatLines } from './crew.model'
import { PlayCrewSheet } from './PlayCrewSheet'
import type { CrewVitals } from './useGameFeed'
import { usePresenceClock } from './usePresenceClock'

const LIST = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[6],
  listStyle: 'none',
  margin: 0,
  padding: 0,
} satisfies CSSProperties

const ITEM = {
  display: 'flex',
  flexDirection: 'column',
  gap: tokens.space[2],
  minWidth: 0,
} satisfies CSSProperties

const RESOLVING = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.note,
  paddingInline: tokens.space[2],
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
        <ul style={LIST} aria-label="Crew">
          {lines.map((line) => (
            <li key={line.pilotId} style={ITEM}>
              <CrewLine line={line} onOpen={() => setOpen(line)} />
              <span role="status" style={RESOLVING}>
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
      form="row"
      model={unitRowModel({ kind: 'pilot', name: line.name })}
      mode={{
        kind: 'link',
        onOpen,
        attrs: { 'aria-label': `${crewLineLabel(line)}. Open their sheet` },
      }}
      labels={
        <>
          <span className="su-play-crew-dot" data-present={line.present || undefined} />
          <Stat
            orientation="horizontal"
            size="mini"
            label={line.boardedIn === null ? 'On foot' : 'Boarded'}
            value={line.boardedIn ?? undefined}
          />
        </>
      }
      trailing={
        vital.attention ? (
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
        ) : (
          <span className="su-play-crew-away">away</span>
        )
      }
    />
  )
}
