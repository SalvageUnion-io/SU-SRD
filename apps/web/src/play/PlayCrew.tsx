/**
 * PlayCrew — the Crew section of the Cockpit's right column (play.md §7),
 * Game only: one Mini per other seat at the table, in the Mini grid
 * (`MiniGrid`; ruleset §1.3: Play's lists are Minis), its Mini chips what
 * the table needs at a glance: the pair as `crewPair` draws it (aboard, the
 * mech's Mini still named for the pilot, with `MECH | Atlas`; on foot, the pilot's with the same chip,
 * C11; the pair's form says on foot or aboard, so no chip repeats it and
 * the name keeps its room), whether they are here ("Here", or "Away" once their seat
 * stops beating), and one vital: the one that needs looking at (▲, critical,
 * as `crewLines()` decides), else, while they are here, their SP aboard or HP
 * on foot.
 *
 * Tapping a line puts that crewmate's pilot sheet on the screen, read-only
 * (`useOpenSheet`, play.md §18). What they are resolving is the Mini's contentful body
 * while there is one (N3: plain words, no entity), announced politely as it
 * changes.
 *
 * Whose turn the Mediator marked (`scenes.current`'s `upNow`) reads above
 * the list, "Up now · You" for this screen's own pilot, and as a chip on that
 * crewmate's line.
 *
 * Presentational over `crewSeatLines`: the caller hands in the crew read
 * (`crew.vitals`, through `useGameFeed`) and the seats.
 */

import type { CSSProperties } from 'react'
import { EmptyState, Entity, MiniGrid, Stat, tokens } from '../components/index'
import { crewPair } from '../lib/units/crewPair'
import { unitRowModel } from '../lib/units/unitModel'
import { playCopy } from '../messages/play'
import type { BoardSources } from './boardMenu.model'
import type { CrewSeatLine } from './crew.model'
import { crewLineLabel, crewSeatLines, pairedMech } from './crew.model'
import type { CrewVitals } from './useGameFeed'
import { useGamePresence } from './useGamePresence'
import { useOpenSheet } from './useOpenSheet'
import { useScene } from './useScene'

const UP_NOW = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.chip,
  fontWeight: tokens.weight.bold,
  margin: 0,
} satisfies CSSProperties

const RESOLVING = {
  color: tokens.color.ink,
  fontFamily: tokens.font.body,
  fontSize: tokens.fontSize.chip,
  margin: 0,
} satisfies CSSProperties

/** A crewmate's numbers, each with its maximum, on one wrapping line. */
const VITALS = { display: 'flex', flexWrap: 'wrap', gap: tokens.space[4] } satisfies CSSProperties

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
  const here = useGamePresence(gameId, 'seat')
  const openSheet = useOpenSheet()
  const lines = crewSeatLines(crew, seats, selfPilotId, here)
  const { upNow } = useScene(gameId)
  const upName = crew?.pilots.find((p) => p.linkId === upNow)?.name

  return (
    <>
      <p role="status" style={UP_NOW} hidden={upNow === undefined || upName === undefined}>
        {upNow === undefined || upName === undefined
          ? ''
          : upNow === selfPilotId
            ? playCopy('upNowYou')
            : playCopy('upNowName', { name: upName })}
      </p>
      {crew === null ? (
        <EmptyState variant="inline" body={playCopy('theCrewAppearsOnceThe')} />
      ) : lines.length === 0 ? (
        <EmptyState variant="inline" body={playCopy('noOneElseIsSeated')} />
      ) : (
        <MiniGrid label={playCopy('crew')} play>
          {lines.map((line) => (
            <li key={line.pilotId}>
              <CrewLine
                line={line}
                upNow={line.pilotId === upNow}
                onOpen={() => openSheet({ kind: 'pilot', id: line.pilotId, name: line.name })}
              />
              <span role="status" className="su-sr-only">
                {line.resolving ?? ''}
              </span>
            </li>
          ))}
        </MiniGrid>
      )}
    </>
  )
}

function CrewLine({
  line,
  upNow,
  onOpen,
}: {
  line: CrewSeatLine
  upNow: boolean
  onOpen: () => void
}) {
  const { vital } = line
  // A pilot and its mech are one Mini (`crewPair`), named for the pilot:
  // aboard, the mech's tone and readings; on foot, the pilot's. A MECH chip either way.
  const pair = crewPair({
    pilot: { id: line.pilotId, name: line.name },
    mech: pairedMech(line),
    boarded: line.boardedIn !== null,
  })
  return (
    <Entity
      size="mini"
      context="roster"
      model={unitRowModel({ kind: pair.kind, name: pair.name })}
      mode={{
        kind: 'link',
        onOpen,
        attrs: {
          'aria-label': `${crewLineLabel(line)}${upNow ? `, ${playCopy('upNow')}` : ''}. Open their sheet`,
        },
      }}
      {...(pair.relations ? { relations: [...pair.relations] } : {})}
      state={
        <>
          <Stat size="mini" label={line.present ? playCopy('here') : playCopy('away')} />
          {upNow ? <Stat size="mini" label={playCopy('upNow')} /> : null}
          {vital.attention ? (
            <Stat
              size="mini"
              state="critical"
              label={`▲ ${vital.label}`}
              value={vital.value ?? undefined}
            />
          ) : null}
        </>
      }
      // Every number with its maximum, then what they are resolving, in words.
      body={{
        text: false,
        children: (
          <>
            <div style={VITALS}>
              {line.vitals.map((v) => (
                <Stat key={v.label} size="mini" surface="plain" label={v.label} value={v.value} />
              ))}
            </div>
            {line.resolving ? <p style={RESOLVING}>{line.resolving}</p> : null}
          </>
        ),
      }}
    />
  )
}
