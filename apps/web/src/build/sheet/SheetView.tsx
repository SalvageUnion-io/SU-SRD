/**
 * SheetView — a sheet route's page body (`/pilots/$id`, `/mechs/$id`,
 * `/crawlers/$id`), minus the router: the one way to view a pilot, mech or
 * crawler, whoever holds it.
 *
 * One address per entity, and what it renders depends on who is looking:
 *
 *  - **Yours to edit, and in this browser** — the editable live sheet, from the
 *    local store. In a Game it also reads the Game's listing (`others`), so its
 *    rail shows assignments to crewmates' entities this browser does not cache:
 *    your crawler's whole crew, the crewmate's mech flying your pilot.
 *  - **Readable but not yours** — a crewmate's pilot or mech, an unassigned
 *    pre-gen, and for a player the Game's crawler, which is the Mediator's
 *    (ADR-038 §5) — the same `<Sheet>`, read-only, from a store built out of
 *    `entities.listForGame` (`readOnlySheetStore.model.ts`). Every body and link in
 *    the Game is in it, so the sheet shows their mech and crawler, and the query
 *    is reactive, so it stays current as they play. Nothing is adopted into the
 *    entity store: a crewmate's sheet there would be an editor whose every save
 *    the server refuses (ADR-037).
 *  - **Neither** — not found, the same answer as no such entity.
 *
 * `useLocatedSheet` tells these apart, as it does for an NPC (`NpcSheetView`).
 *
 * `games.get` says whether the caller runs that Game's table, which is who
 * writes its crawler (ADR-038 §5). On a player's own sheet the cargo moves and
 * scrap draws that would write it are closed (`crawlerReadOnly`) rather than
 * left to half-land when the server refuses them.
 *
 * Lives here rather than in the route file so that file exports nothing but
 * `Route` (`routes/__tests__/routeExports.test.ts`).
 */

import { useQuery } from 'convex/react'
import { containerOf } from 'game-domain/container'
import type { SheetKind } from 'game-domain/entityKinds'
import { useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { useSync } from '../../replica/syncContext'
import { CrewSheetBanner } from './CrewSheetBanner'
import type { EntityLookup } from './composition.model'
import { makeReadOnlySheetStore, sheetDataFromListing } from './readOnlySheetStore.model'
import { Sheet } from './Sheet'
import { SheetFallback } from './SheetFallback'
import { SheetModeContext } from './sheetMode.model'
import type { OwnerOf } from './unitOwners.model'
import { ownersFromListing } from './unitOwners.model'
import { useLocatedSheet } from './useLocatedSheet'

type SheetViewProps = { kind: SheetKind; id: string }

export function SheetView({ kind, id }: SheetViewProps) {
  const { status: sync } = useSync()
  const { status, held, gameId, listing, members, me, sheetMode, crew } = useLocatedSheet(kind, id)

  // The Game whose crawler this sheet's cargo reaches: the server's answer once
  // it has one, the local copy's until then (a linked crawler shares its
  // container, ADR-037). Closed until the server says the viewer runs it.
  const heldIn = held === null ? null : containerOf(held)
  const tableId = gameId ?? (heldIn?.kind === 'game' ? (heldIn.gameId as Id<'games'>) : null)
  const table = useQuery(
    api.games.get,
    sync === 'live' && tableId !== null ? { gameId: tableId } : 'skip'
  )
  const crawlerReadOnly = tableId !== null && table?.tableRunner !== true

  // Who holds each listed pilot and mech: the owner chips on Assigned units.
  const ownerOf = useMemo<OwnerOf | undefined>(
    () => (listing && members ? ownersFromListing(listing, members, me?._id ?? null) : undefined),
    [listing, members, me]
  )

  const store = useMemo(
    () => (listing ? makeReadOnlySheetStore(sheetDataFromListing(listing)) : null),
    [listing]
  )
  const others = useMemo<EntityLookup | undefined>(
    () => (store ? { get: (type, entityId) => store.getState().get(type, entityId) } : undefined),
    [store]
  )

  // Yours: the local copy, editable. It opens in Read, and the band's
  // Read | Edit switches (`sheetMode.model.ts`).
  if (status === 'yours') {
    return (
      <SheetModeContext.Provider value={sheetMode}>
        <Sheet
          kind={kind}
          id={id}
          others={others}
          crawlerReadOnly={crawlerReadOnly}
          ownerOf={ownerOf}
        />
      </SheetModeContext.Provider>
    )
  }
  if (status !== 'listed' || store === null) {
    return (
      <SheetFallback kind={kind} status={status === 'listed' ? 'loading' : status} back={crew} />
    )
  }
  if (store.getState().get(kind, id) === null) {
    return <SheetFallback kind={kind} status="unreadable" back={crew} />
  }
  return (
    <CrewSheetBanner kind={kind}>
      <Sheet kind={kind} id={id} store={store} back={crew} readOnly ownerOf={ownerOf} />
    </CrewSheetBanner>
  )
}
