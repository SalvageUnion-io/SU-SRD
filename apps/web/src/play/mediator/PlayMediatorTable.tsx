/**
 * PlayMediatorTable — the Mediator's left column (play.md §10, wireframe pin
 * 2): "The table", a Slab, with one seat per player directly under it
 * (`PlayMediatorSeat`, a Mini one a line), then the Game's crawler as the Units
 * column's own crawler box (`PlayCrawlerUnit`), live for the Mediator, who
 * runs it (ADR-038 §5).
 *
 * A tap on a seat aims Propose at that pilot and moves focus to its To field;
 * Sheet opens their sheet read-only (`PlayCrewSheet`), the crawler's opens
 * its live sheet in Build (`useOpenSheet`). With no crawler it says where to raise
 * one.
 */

import { gamePath } from 'game-domain/entityKinds'
import { downtimeStepCount } from 'game-domain/rules/downtime'
import { useState } from 'react'
import { EmptyState, FOCUS_RING, Slab } from '../../components/index'
import { AppLink } from '../../components/shared/AppLink'
import { PlayCrewSheet } from '../PlayCrewSheet'
import { PlayCrawlerUnit } from '../PlayUnits'
import { useOpenSheet } from '../useOpenSheet'
import type { MediatorSeat } from './mediatorTable.model'
import { seatDone, seatStepLine } from './mediatorTable.model'
import { PlayMediatorSeat } from './PlayMediatorSeat'
import type { PlayMediator } from './usePlayMediator'

type PlayMediatorTableProps = {
  mediator: PlayMediator
  /** The pilot row Propose is aimed at, if a seat is. */
  picked: string | null
  onPick: (seat: MediatorSeat) => void
}

export function PlayMediatorTable({ mediator, picked, onPick }: PlayMediatorTableProps) {
  const [crewSheet, setCrewSheet] = useState<MediatorSeat | null>(null)
  const setSheet = useOpenSheet()
  const { seats, downtime, crawler, canWrite } = mediator
  const running = downtime.downtime.running
  const stepIndex = Math.min(downtime.downtime.stepIndex ?? 0, downtimeStepCount() - 1)

  return (
    <>
      <Slab as="h2" label="The table" />
      {mediator.crew === null ? (
        <EmptyState variant="inline" body="The table appears once the Game's roster arrives." />
      ) : seats.length === 0 ? (
        <EmptyState
          variant="inline"
          body="No one has a seat yet. A player takes one by claiming a Pilot in this Game."
        />
      ) : (
        <ul className="su-entity-mini-list su-play-seats" aria-label="Seats" data-play-list="">
          {seats.map((seat) => (
            <PlayMediatorSeat
              key={seat.pilotId}
              seat={seat}
              picked={picked === seat.rowId}
              dim={picked !== null && picked !== seat.rowId}
              onPick={() => onPick(seat)}
              onOpenSheet={() => setCrewSheet(seat)}
              stepLine={
                running
                  ? seatStepLine(
                      stepIndex,
                      seatDone(seat, downtime.downtime.completedBy),
                      seat.present
                    )
                  : null
              }
            />
          ))}
        </ul>
      )}
      {crawler === null ? (
        <>
          <EmptyState variant="inline" body="This Game has no Union Crawler yet." />
          <AppLink href={gamePath(mediator.gameId)} className={FOCUS_RING}>
            Raise one from the Game page
          </AppLink>
        </>
      ) : (
        <PlayCrawlerUnit
          crawler={crawler.crawler}
          live={canWrite && crawler.held}
          downtime={running}
          onOpenSheet={() =>
            setSheet({ kind: 'crawler', id: crawler.crawler.id, name: crawler.crawler.name })
          }
        />
      )}
      <PlayCrewSheet
        gameId={mediator.gameId}
        pilotId={crewSheet?.pilotId ?? null}
        name={crewSheet?.name ?? ''}
        onClose={() => setCrewSheet(null)}
      />
    </>
  )
}
