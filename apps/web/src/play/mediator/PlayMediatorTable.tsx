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
import type { ProposalTarget } from 'game-domain/games/proposals'
import { proposalTargets } from 'game-domain/games/proposals'
import { currentDowntimeStep } from 'game-domain/rules/downtime'
import { useState } from 'react'
import { Button, EmptyState, Slab, toast } from '../../components/index'
import { ADD_CREW_ANCHOR } from '../../lib/games/gameRoster'
import { mediatorCopy } from '../../messages/play-mediator'
import { PlayCrewSheet } from '../PlayCrewSheet'
import { PlayCrawlerUnit } from '../PlayUnits'
import { useOpenSheet } from '../useOpenSheet'
import { MediatorInitiative } from './MediatorInitiative'
import type { MediatorSeat } from './mediatorTable.model'
import { seatDone, seatStepLine } from './mediatorTable.model'
import type { SeatHit } from './PlayMediatorSeat'
import { PlayMediatorSeat } from './PlayMediatorSeat'
import type { ProposeArgs } from './ProposeDock'
import { useInitiative } from './useInitiative'
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
  const stepIndex = currentDowntimeStep(downtime.downtime.stepIndex).index
  // Group Initiative (r6 B4): an action scene's, so not while Downtime runs.
  const tracker = useInitiative(mediator.gameId, mediator.onFailure, mediator)
  const kept = running ? null : tracker.initiative
  const targets = proposalTargets(mediator.crew)

  return (
    <>
      <Slab as="h2" label={mediatorCopy('theTable')} flush />
      {!running && seats.length > 0 && <MediatorInitiative mediator={mediator} tracker={tracker} />}
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
              picked={picked === seat.rowId || picked === seat.aimId}
              onPick={() => onPick(seat)}
              onOpenSheet={() => setCrewSheet(seat)}
              upNow={mediator.scene.upNow === seat.pilotId}
              hits={canWrite ? seatHits(seat, targets, mediator.propose) : undefined}
              acted={
                kept === null
                  ? undefined
                  : {
                      acted: kept.acted.includes(seat.pilotId),
                      onToggle: canWrite
                        ? () => tracker.setActed(seat.pilotId, !kept.acted.includes(seat.pilotId))
                        : undefined,
                    }
              }
              onUpNow={
                canWrite
                  ? () =>
                      void mediator.scene.setUpNow(
                        mediator.scene.upNow === seat.pilotId ? null : seat.pilotId
                      )
                  : undefined
              }
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
          <Button href={`${gamePath(mediator.gameId)}#${ADD_CREW_ANCHOR}`} size="compact">
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

/**
 * A seat's Pilot HP and Mech SP, each one press from a hit (r8 B1): what the
 * hit leaves goes to the player as a proposal they accept, the one Propose
 * sends and the Game's page lists.
 */
function seatHits(
  seat: MediatorSeat,
  targets: readonly ProposalTarget[],
  propose: (args: ProposeArgs) => Promise<void>
): SeatHit[] {
  const pilot = targets.find((t) => t.kind === 'pilot' && t.id === seat.rowId)
  const mech = targets.find((t) => t.kind === 'mech' && t.pilotLinkId === seat.pilotId)
  const hits: SeatHit[] = []
  for (const [target, field, label] of [
    [pilot, 'currentHP', 'HP'],
    [mech, 'currentSP', 'SP'],
  ] as const) {
    const reading = target?.readings[field]
    const max = reading?.max ?? null
    if (target === undefined || max === null) continue
    const value = reading?.current ?? max
    hits.push({
      label,
      target: target.label,
      value,
      max,
      onPropose: (after) =>
        void propose({ entityId: target.id, entityType: target.kind, field, after })
          .then(() =>
            toast.success(
              mediatorCopy('hitProposed', { name: target.label, unit: label, before: value, after })
            )
          )
          // The caller has already said why.
          .catch(() => undefined),
    })
  }
  return hits
}
