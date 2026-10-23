/**
 * useLocatedSheet — the one "yours, a crewmate's, or not found" answer every
 * sheet page gives (`/pilots/$id` and its siblings), pilot, mech, crawler and NPC alike (`SheetView`,
 * `NpcSheetView`).
 *
 * `entities.locate` is what tells them apart: which Game holds the entity, and
 * whether the caller may edit it. It is asked even of an entity this browser
 * holds, because the Game is what the listing beside it is read from, and
 * because "held here" is not "yours" — a copy can outlive its ownership.
 *
 *  - **yours** — held here, and the server does not say otherwise.
 *  - **listed** — a Game the viewer belongs to lists it: a crewmate's, read
 *    live from `entities.listForGame` and never cached (ADR-037). Whether its
 *    body parses is the page's to say ("Could not show this …").
 *  - **missing** — not yours, not at a table of yours, or nothing at all: one
 *    answer for all three, as `listForGame` gives a non-member. Signed out
 *    with nothing held is the same answer.
 *  - **offline** — a Game is shared state, and it cannot be read without a
 *    connection.
 *  - **loading** — mid-handshake, still locating, yours on its way into this
 *    browser (`ShelfSync`), the listing on its way, or a Convex row id being
 *    swapped for the canonical app id.
 *
 * A Convex row id is what the Discord bot's sheet links carry, and what links
 * already posted to the retired crew-view URL redirect with. Once located, it
 * is replaced by the canonical app id every other link uses.
 */

import type { LinkProps } from '@tanstack/react-router'
import { useRouter } from '@tanstack/react-router'
import { useQuery } from 'convex/react'
import type { EntityKind } from 'game-domain/entityKinds'
import { gamePath, sheetPath } from 'game-domain/entityKinds'
import { PRODUCT } from 'game-domain/product'
import { useEffect, useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import { useConnection } from '../../lib/connection/connectionContext'
import type { ServerCrawler, ServerOwnable } from '../../lib/games/gameRoster'
import { areaTitle } from '../../lib/pageTitle'
import { useEntityStore } from '../../stores/entityStore'
import type { GameListing } from './readOnlySheetStore.model'
import { rowAppId } from './readOnlySheetStore.model'
import { useSheetModeStore } from './sheetMode.model'

type LocatedStatus = 'yours' | 'listed' | 'missing' | 'offline' | 'loading'

/** A listed row of one kind: a crawler is communal, so it has no owner. */
type ListedRow<K extends EntityKind> = K extends 'crawler' ? ServerCrawler : ServerOwnable

/** The listing's rows of one kind. */
function rowsOf<K extends EntityKind>(listing: GameListing, kind: K): readonly ListedRow<K>[] {
  const rows = {
    pilot: listing.pilots,
    mech: listing.mechs,
    crawler: listing.crawlers,
    npc: listing.npcs,
  }[kind]
  return rows as readonly ListedRow<K>[]
}

export function useLocatedSheet<K extends EntityKind>(kind: K, id: string) {
  const { mode } = useConnection()
  const router = useRouter({ warn: false })
  // Read | Edit, held for the visit as on every sheet (`sheetMode.model.ts`).
  const editing = useSheetModeStore((s) => s.editing)
  const setEditing = useSheetModeStore((s) => s.setEditing)
  const sheetMode = useMemo(() => ({ editing, setEditing }), [editing, setEditing])
  const held = useEntityStore((s) => s.get(kind, id))

  const online = mode === 'connected'
  const located = useQuery(api.entities.locate, online ? { kind, id } : 'skip')
  const gameId = located?.gameId ?? null
  const listing = useQuery(api.entities.listForGame, gameId === null ? 'skip' : { gameId })
  const members = useQuery(api.games.members, gameId === null ? 'skip' : { gameId })
  const me = useQuery(api.account.me, online ? {} : 'skip')

  // Names the tab after the entity, and follows a rename. The route's `head`
  // can only say "Sheet": it runs once per navigation, and a loader may not
  // read a player entity (`.claude/rules/tanstack-router.md`). One this browser
  // does not hold (a crewmate's) keeps the generic title.
  const name = held?.name ?? null
  useEffect(() => {
    document.title = areaTitle(PRODUCT.build, name || (kind === 'npc' ? 'NPC' : 'Sheet'))
  }, [name, kind])

  const canonical = held === null && located ? located.id : id
  useEffect(() => {
    if (canonical === id) return
    void router?.navigate({ to: sheetPath(kind, canonical) as LinkProps['to'], replace: true })
  }, [canonical, id, kind, router])

  const listedRow =
    listing === undefined ? undefined : rowsOf(listing, kind).find((row) => rowAppId(row) === id)

  const status: LocatedStatus =
    held !== null && (located == null || located.mayEdit)
      ? 'yours'
      : !online
        ? mode === 'connecting'
          ? 'loading'
          : mode === 'solo'
            ? 'missing'
            : 'offline'
        : located === undefined || canonical !== id
          ? 'loading'
          : located === null
            ? 'missing'
            : located.mayEdit || listing === undefined
              ? 'loading'
              : listedRow !== undefined
                ? 'listed'
                : 'missing'

  return {
    status,
    held,
    located,
    gameId,
    listing,
    /** The listing's row for this entity, when the Game lists it. */
    listedRow,
    members,
    me,
    sheetMode,
    /** The way back from a crewmate's sheet: that Game's own page, in Play. */
    crew: gameId === null ? undefined : { href: gamePath(gameId), label: 'the crew' },
  }
}
