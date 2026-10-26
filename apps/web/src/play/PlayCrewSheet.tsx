/**
 * PlayCrewSheet — a crewmate's pilot sheet, read-only, as an overlay over
 * Play (play.md §7): tapping a Crew line opens it, Escape or ✕ closes it, and
 * Play stays where it was underneath.
 *
 * Built the way `SheetView` builds a crewmate's sheet, without its router
 * and tab-title side effects: the Game's listing (`entities.listForGame`) as a
 * read-only store, so the sheet shows their mech and crawler too and stays
 * live as they play. Nothing is adopted into the entity store (ADR-037).
 *
 * The overlay is level 0 (play.md §12); the note is an unlabelled Callout.
 */

import { useMemo } from 'react'
import {
  makeReadOnlySheetStore,
  sheetDataFromListing,
} from '../build/sheet/readOnlySheetStore.model'
import { Sheet } from '../build/sheet/Sheet'
import { Callout, ModalShell, Pending } from '../components/index'
import { playCopy } from '../messages/play'
import { useGamesQuery } from '../replica/roomCalls'

type PlayCrewSheetProps = {
  gameId: string
  /** The crewmate's pilot (its link id), or null when nothing is open. */
  pilotId: string | null
  name: string
  onClose: () => void
}

export function PlayCrewSheet({ gameId, pilotId, name, onClose }: PlayCrewSheetProps) {
  return (
    <ModalShell
      open={pilotId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={playCopy('readOnly', { name })}
    >
      {pilotId !== null && <CrewSheetBody gameId={gameId} pilotId={pilotId} />}
    </ModalShell>
  )
}

function CrewSheetBody({ gameId, pilotId }: { gameId: string; pilotId: string }) {
  const listing = useGamesQuery('entities.listForGame', { gameId: gameId })
  const store = useMemo(
    () => (listing ? makeReadOnlySheetStore(sheetDataFromListing(listing)) : null),
    [listing]
  )
  if (store === null) return <Pending label={playCopy('theirSheet')} />
  return (
    <>
      <Callout>{playCopy('youAreReadingACrewmates')}</Callout>
      <Sheet kind="pilot" id={pilotId} store={store} readOnly />
    </>
  )
}
