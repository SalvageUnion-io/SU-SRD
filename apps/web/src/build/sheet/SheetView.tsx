/**
 * SheetView — the `/sheet/$kind/$id` page body, minus the router: the one way
 * to view a pilot, mech or crawler, whoever holds it.
 *
 * One address per entity, and what it renders depends on who is looking:
 *
 *  - **Yours to edit, and in this browser** — the editable live sheet, from the
 *    local store. In a Game it also reads the Game's listing (`others`), so its
 *    rail shows assignments to crewmates' entities this browser does not cache:
 *    your crawler's whole crew, the crewmate's mech flying your pilot.
 *  - **Readable but not yours** — a crewmate's pilot or mech, an unclaimed
 *    pre-gen, and for a player the Game's crawler, which is the Mediator's
 *    (ADR-038 §5) — the same `<Sheet>`, read-only, from a store built out of
 *    `entities.listForGame` (`readOnlySheetStore.model.ts`). Every body and link in
 *    the Game is in it, so the sheet shows their mech and crawler, and the query
 *    is reactive, so it stays current as they play. Nothing is adopted into the
 *    entity store: a crewmate's sheet there would be an editor whose every save
 *    the server refuses (ADR-037).
 *  - **Neither** — not found, the same answer as no such entity.
 *
 * `entities.locate` is what tells these apart: which Game holds the entity, and
 * whether the caller may edit it. It is asked even of an entity this browser
 * holds, because the Game is what the listing beside it is read from, and
 * because "held here" is not "yours" — a copy can outlive its ownership.
 *
 * `games.get` says whether the caller runs that Game's table, which is who
 * writes its crawler (ADR-038 §5). On a player's own sheet the cargo moves and
 * scrap draws that would write it are closed (`crawlerReadOnly`) rather than
 * left to half-land when the server refuses them.
 *
 * Lives here rather than in the route file so that file exports nothing but
 * `Route` (`routes/__tests__/routeExports.test.ts`).
 */

import { useRouter } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import { containerOf } from 'game-domain/container'
import type { SheetKind } from 'game-domain/entityKinds'
import { gamePath } from 'game-domain/entityKinds'
import { PRODUCT } from 'game-domain/product'
import { useEffect, useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { NotFoundPanel } from '../../components/shared/RouteFallbacks'
import { useConnection } from '../../lib/connection/connectionContext'
import { areaTitle } from '../../lib/pageTitle'
import { useEntityStore } from '../../stores/entityStore'
import type { EntityLookup } from './composition.model'
import { READ_ONLY_BANNER } from './readOnlyBanner.model'
import type { GameListing } from './readOnlySheetStore.model'
import { makeReadOnlySheetStore, sheetDataFromListing } from './readOnlySheetStore.model'
import { Sheet } from './Sheet'
import { SheetSkeleton } from './SheetSkeleton'
import { SheetModeContext, useSheetModeStore } from './sheetMode.model'
import type { OwnerOf } from './unitOwners.model'
import { ownersFromListing } from './unitOwners.model'

type SheetViewProps = { kind: SheetKind; id: string }

/**
 * Names the tab after the entity, and follows a rename. The route's `head`
 * can only say "Sheet": it runs once per navigation, and a loader may not read
 * a player entity (`.claude/rules/tanstack-router.md`). A sheet this browser
 * does not hold (a crewmate's) keeps that generic title. `<HeadContent />`
 * rewrites the tab on the next navigation, since every other route's title
 * differs from the sheet's.
 */
function useSheetTabTitle(kind: SheetKind, id: string) {
  const name = useEntityStore((s) => s.get(kind, id)?.name ?? null)
  useEffect(() => {
    document.title = areaTitle(PRODUCT.build, name || 'Sheet')
  }, [name])
}

/** Whether the listing carries a row for this entity, parseable or not. */
function listed(listing: GameListing, kind: SheetKind, id: string): boolean {
  const rows =
    kind === 'pilot' ? listing.pilots : kind === 'mech' ? listing.mechs : listing.crawlers
  return rows.some((row) => (row.appId ?? (row.body as { id?: unknown } | null)?.id) === id)
}

export function SheetView({ kind, id }: SheetViewProps) {
  useSheetTabTitle(kind, id)
  const { mode } = useConnection()
  const router = useRouter({ warn: false })
  const editing = useSheetModeStore((s) => s.editing)
  const setEditing = useSheetModeStore((s) => s.setEditing)
  const sheetMode = useMemo(() => ({ editing, setEditing }), [editing, setEditing])
  const held = useEntityStore((s) => s.get(kind, id))

  const online = mode === 'connected'
  const located = useQuery(api.entities.locate, online ? { kind, id } : 'skip')
  const gameId = located?.gameId ?? null
  const listing = useQuery(api.entities.listForGame, gameId === null ? 'skip' : { gameId })
  // The Game whose crawler this sheet's cargo reaches: the server's answer once
  // it has one, the local copy's until then (a linked crawler shares its
  // container, ADR-037). Closed until the server says the viewer runs it.
  const heldIn = held === null ? null : containerOf(held)
  const tableId = gameId ?? (heldIn?.kind === 'game' ? (heldIn.gameId as Id<'games'>) : null)
  const table = useQuery(api.games.get, online && tableId !== null ? { gameId: tableId } : 'skip')
  const crawlerReadOnly = tableId !== null && table?.tableRunner !== true

  // Who holds each listed pilot and mech: the owner chips on a crawler's
  // Assigned units.
  const me = useQuery(api.account.me, gameId === null ? 'skip' : {})
  const members = useQuery(api.games.members, gameId === null ? 'skip' : { gameId })
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

  // A Convex row id is what the Discord bot's /sheet/ links carry, and what
  // links already posted to the retired crew-view URL redirect with. Once
  // located, it is replaced by the canonical app id every other link uses.
  const canonical = held === null && located ? located.id : id
  useEffect(() => {
    if (canonical === id) return
    void router?.navigate({
      to: '/sheet/$kind/$id',
      params: { kind, id: canonical },
      replace: true,
    })
  }, [canonical, id, kind, router])

  // `gamePath` is that Game's own page, in Play — a plain `/` is the shelf.
  const crew = gameId === null ? undefined : { href: gamePath(gameId), label: 'the crew' }

  // Yours: the local copy, editable — unless the server says otherwise. It
  // opens in Read, and the band's Read | Edit switches (`sheetMode.model.ts`).
  if (held !== null && (located == null || located.mayEdit)) {
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

  if (!online) {
    // Signed out, nothing here: the ordinary not-found. Mid-handshake: a beat
    // from knowing. Offline: a Game is shared state, and it cannot be read.
    if (mode === 'solo') return <Sheet kind={kind} id={id} />
    if (mode === 'connecting') return <SheetSkeleton />
    return (
      <NotFoundPanel
        title={`${kind} unavailable offline`}
        message={`This ${kind} was not loaded before the connection dropped, and loading it needs a connection.`}
      />
    )
  }

  if (located === undefined || canonical !== id) return <SheetSkeleton />
  // Not yours, not at a table of yours, or nothing at all — one answer for all
  // three, as `listForGame` gives a non-member.
  if (located === null) return <Sheet kind={kind} id={id} />
  // Yours, and on its way into the store (`ShelfSync`): wait for it
  // rather than flash a read-only copy of your own sheet.
  if (located.mayEdit) return <SheetSkeleton />

  if (listing === undefined || store === null) return <SheetSkeleton />
  if (store.getState().get(kind, id) === null) {
    return listed(listing, kind, id) ? (
      <NotFoundPanel
        title={`Could not show this ${kind}`}
        message={`This ${kind}’s data doesn’t match anything this app knows how to show. It may have been built in a newer version.`}
        back={crew}
      />
    ) : (
      <Sheet kind={kind} id={id} store={store} back={crew} readOnly ownerOf={ownerOf} />
    )
  }

  return (
    <div className="su-page-gutters">
      {/* Saying WHY it is read-only matters more than saying that it is: a
          player who cannot edit a crewmate's pilot should read that as the rule
          of the table, not as something broken. */}
      <div
        role="note"
        aria-label="Read-only crew sheet"
        className="su-sheet-gutter"
        // Its gutter is `.su-sheet-gutter`.
        style={READ_ONLY_BANNER}
      >
        {kind === 'crawler'
          ? 'This is the crew’s crawler. Only the Mediator changes it; ask at the table.'
          : 'You are reading a crewmate’s sheet. Only whoever holds it can make changes.'}
      </div>
      <Sheet kind={kind} id={id} store={store} back={crew} readOnly ownerOf={ownerOf} />
    </div>
  )
}
