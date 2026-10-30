/**
 * PlayMediatorTable — the Mediator's left column (play.md §10): "The table", a Slab, with one seat per player directly under it
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
import { Button, EmptyState, Slab } from '../../components/index'
import { mediatorCopy } from '../../messages/play-mediator'
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
      <Slab as="h2" label={mediatorCopy('theTable')} />
      {mediator.crew === null ? (
        <EmptyState variant="inline" body={mediatorCopy('theTableAppearsOnceThe')} />
      ) : seats.length === 0 ? (
        <EmptyState variant="inline" body={mediatorCopy('noOneHasASeat')} />
      ) : (
        <ul
          className="su-entity-mini-list su-play-seats"
          aria-label={mediatorCopy('seats')}
          data-play-list=""
        >
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
          <EmptyState variant="inline" body={mediatorCopy('thisGameHasNoUnion')} />
          <Button href={gamePath(mediator.gameId)} size="compact">
            {mediatorCopy('raiseOneFromTheGame')}
          </Button>
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
