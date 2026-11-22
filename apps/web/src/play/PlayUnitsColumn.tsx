/**
 * PlayUnitsColumn — the Cockpit's left column (~300px, play.md §4): the pilot, the mech and the crawler, live or for reference, with the
 * pilot's other mechs between them as the hangar.
 *
 * - **Pilot** — always live (while writes may go): HP, AP, class, TP, injuries.
 * - **Mech** — the one the seat is boarded in, else the assigned one. Live
 *   only while Boarded: SP, EP, Heat and the range band (`seats.setRange`).
 *   Parked it is for reference, with Board. In Downtime it is in the Mech Bay
 *   and says what the current step restores.
 * - **Companions** — the pilot's partners under its box, the mech's drones
 *   under its: Minis whose tap puts the companion's card on the screen.
 * - **Hangar** — the pilot's other mechs, Minis in the Mini grid.
 * - **Crawler** — SP, TL and its bays; live in solo Downtime (or for the
 *   Mediator, whose screen draws the same box), otherwise for reference.
 *
 * "Sheet" on a box puts that unit's sheet on the screen (`useOpenSheet`, play.md §18).
 *
 * Its heading is a Slab, never a `TitledBox`, so each unit's box is level 1
 * and what is inside one is a Mini or plain content (play.md §12).
 */

import { resolveEffectiveCrawlerLevel } from 'game-domain/crawlerLevel'
import { pilotLabel } from 'game-domain/pilotLabel'
import { CloseButton, EmptyState, MiniGrid, Slab } from '../components/index'
import { playCopy } from '../messages/play'
import { PlayCompanions } from './PlayCompanions'
import { PlayCrawlerUnit, PlayHangarMech, PlayMechUnit, PlayPilotUnit } from './PlayUnits'
import type { PlayColumnProps } from './situation.model'
import { useOpenSheet } from './useOpenSheet'
import { usePlayUnits } from './usePlayUnits'

export function PlayUnitsColumn({
  play,
  onClose,
}: PlayColumnProps & {
  /** Below `lg` the pane has no tab of its own: its × goes back to Act. */
  onClose?: () => void
}) {
  const units = usePlayUnits(play)
  const setSheet = useOpenSheet()
  const { pilot, seat } = play
  const mech = units.mech?.mech ?? null
  const crawler = units.crawler?.crawler ?? null

  return (
    <>
      <Slab
        as="h2"
        label={playCopy('units')}
        flush
        actions={onClose && <CloseButton label={playCopy('closeUnits')} onClick={onClose} />}
      />
      {pilot ? (
        <PlayPilotUnit
          pilot={pilot}
          crawler={crawler}
          live={units.live.pilot}
          onOpenSheet={() => setSheet({ kind: 'pilot', id: pilot.id, name: pilotLabel(pilot) })}
        />
      ) : (
        <EmptyState variant="inline" body={playCopy('thePilotIsOnIts')} />
      )}
      {pilot ? (
        <PlayCompanions
          host={{ kind: 'pilot', id: pilot.id, name: pilotLabel(pilot) }}
          partners={pilot.partners}
          crawlerTechLevel={resolveEffectiveCrawlerLevel(pilot, crawler)}
        />
      ) : null}
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
      {mech ? (
        <PlayCompanions
          host={{ kind: 'mech', id: mech.id, name: mech.name }}
          partners={mech.partners}
        />
      ) : null}
      {units.hangar.length > 0 ? (
        <MiniGrid label={playCopy('hangar')} play>
          {units.hangar.map((spare) => (
            <PlayHangarMech
              key={spare.mechId}
              name={spare.name}
              chassis={spare.chassis}
              note={spare.note}
            />
          ))}
        </MiniGrid>
      ) : null}
      {units.crawler ? (
        <PlayCrawlerUnit
          crawler={units.crawler.crawler}
          live={units.live.crawler}
          downtime={play.situation === 'downtime'}
          onOpenSheet={
            // In Downtime the crawler's sheet is on hand whoever writes it (r5 A14).
            (units.live.crawler || (play.situation === 'downtime' && units.crawler.held)) && crawler
              ? () => setSheet({ kind: 'crawler', id: crawler.id, name: crawler.name })
              : undefined
          }
        />
      ) : null}
    </>
  )
}
