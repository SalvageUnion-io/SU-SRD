/**
 * PlayUnitsColumn — the Cockpit's left column (~300px, play.md §4, wireframe
 * pin 4): the pilot, the mech and the crawler, live or for reference, with the
 * pilot's other mechs between them as the hangar.
 *
 * - **Pilot** — always live (while writes may go): HP, AP, class, TP, injuries.
 * - **Mech** — the one the seat is boarded in, else the assigned one. Live
 *   only while Boarded: SP, EP, Heat and the range band (`seats.setRange`).
 *   Parked it is for reference, with Board. In Downtime it is in the Mech Bay
 *   and says what the current step restores.
 * - **Hangar** — the pilot's other mechs, each a full-width Token.
 * - **Crawler** — SP, TL and its bays; live in solo Downtime (or for the
 *   Mediator, whose screen draws the same box), otherwise for reference.
 *
 * "Sheet ⤢" on a box opens that unit's sheet over Play (`PlaySheetOverlay`).
 *
 * Its heading is a Slab, never a `TitledBox`, so each unit's box is level 1
 * and what is inside one is a Token or plain content (play.md §12).
 */

import { useState } from 'react'
import { EmptyState, Slab } from '../components/index'
import type { SheetTarget } from './PlaySheetOverlay'
import { PlaySheetOverlay } from './PlaySheetOverlay'
import { PlayCrawlerUnit, PlayHangarMech, PlayMechUnit, PlayPilotUnit } from './PlayUnits'
import type { PlayColumnProps } from './situation.model'
import { usePlayUnits } from './usePlayUnits'

export function PlayUnitsColumn({ play }: PlayColumnProps) {
  const units = usePlayUnits(play)
  const [sheet, setSheet] = useState<SheetTarget | null>(null)
  const { pilot, seat } = play
  const mech = units.mech?.mech ?? null
  const crawler = units.crawler?.crawler ?? null

  return (
    <>
      <Slab variant="solid" as="h2" label="Units" />
      {pilot ? (
        <PlayPilotUnit
          pilot={pilot}
          crawler={crawler}
          live={units.live.pilot}
          onOpenSheet={() => setSheet({ kind: 'pilot', id: pilot.id, name: pilot.name })}
        />
      ) : (
        <EmptyState variant="inline" body="The Pilot is on its way." />
      )}
      {units.mech ? (
        <PlayMechUnit
          mech={units.mech.mech}
          pilotAbilities={pilot?.abilities}
          activeEffects={units.mech.place === 'boarded' ? seat.seat.activeEffects : []}
          onToggleEffect={units.live.mech ? seat.toggleEffect : undefined}
          place={units.mech.place}
          live={units.live.mech}
          range={seat.seat.range}
          onRange={units.live.mech ? seat.setRange : undefined}
          restore={units.mech.restore}
          onBoard={units.board}
          onOpenSheet={
            units.mech.held && mech
              ? () => setSheet({ kind: 'mech', id: mech.id, name: mech.name })
              : undefined
          }
        />
      ) : null}
      {units.hangar.map((spare) => (
        <PlayHangarMech
          key={spare.mechId}
          name={spare.name}
          chassis={spare.chassis}
          note={spare.note}
        />
      ))}
      {units.crawler ? (
        <PlayCrawlerUnit
          crawler={units.crawler.crawler}
          live={units.live.crawler}
          downtime={play.situation === 'downtime'}
          onOpenSheet={
            units.live.crawler && crawler
              ? () => setSheet({ kind: 'crawler', id: crawler.id, name: crawler.name })
              : undefined
          }
        />
      ) : null}
      <PlaySheetOverlay sheet={sheet} onClose={() => setSheet(null)} />
    </>
  )
}
