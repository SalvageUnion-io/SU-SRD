/**
 * The destructive and ownership verbs on a Game roster row, each behind its
 * confirm.
 *
 * Every verb here changes who has a build or whether it exists — picking it up,
 * offering it back, copying it, deleting it, scrapping the crawler — so none of
 * them runs on the press. Each opens the surface's confirm (`useConfirm`) with
 * its words from `lib/games/rowActionCopy.ts`, and does the work only when the
 * player confirms. A failure stays on the dialog with its reason.
 *
 * Kept out of `GameRoster` so another surface that lists the same rows offers
 * the same verbs with the same consequences, rather than a second copy of each
 * mutation sequence drifting from the first. What a row is ALLOWED to do is
 * still `row.can` (`lib/games/gameRoster.ts`); this only does it.
 */

import { toast } from 'component-lib'
import { useMutation } from 'convex/react'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import { moveTo, SHELF } from '../../lib/container'
import { copyForShelf } from '../../lib/copyEntity'
import type { RosterRow } from '../../lib/games/gameRoster'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { useEntityStore } from '../../stores/entityStore'
import { CONTAINER_MOVE } from '../../stores/surfaceProvenance'
import type { Confirm } from '../shared/useConfirm'

/** The table a pilot or mech row's ownership mutations address. */
function ownableTable(row: RosterRow): 'pilots' | 'mechs' {
  return row.kind === 'pilot' ? 'pilots' : 'mechs'
}

export type RowActions = {
  /** Claim an unclaimed character; `ShelfSync` brings it into this browser. */
  pickUp: (row: RosterRow) => void
  /** Hand a character you hold back to the crew. */
  offer: (row: RosterRow) => void
  /** Copy a pilot or mech into My stuff. */
  copy: (row: RosterRow) => void
  /**
   * Take a build out of the Game it is in, to My stuff — same record, same id
   * (a move, never a copy). `gameName` names the Game in the confirm.
   */
  removeFromGame: (row: RosterRow, gameName: string | null) => void
  /** Delete a pilot or mech you own, for everyone. */
  remove: (row: RosterRow) => void
  /** Scrap the crew's crawler (the table runner's act). */
  scrap: (row: RosterRow) => void
}

export function useRowActions(confirm: Confirm): RowActions {
  const claim = useMutation(api.ownership.claim)
  const release = useMutation(api.ownership.release)
  const scrapCrawler = useMutation(api.entities.removeCrawler)
  const removeEntity = useMutation(api.entities.remove)

  /** Drop this browser's cached copy once the server no longer lets us hold it. */
  async function forgetLocal(row: RosterRow): Promise<void> {
    if (row.localId !== null) await useEntityStore.getState().forget(row.kind, row.localId)
  }

  return {
    pickUp: (row) =>
      confirm({
        ...ROW_ACTION_COPY.pickUp(row.name),
        onConfirm: async () => {
          // Nothing to pull down by hand: it is yours now, so it is in
          // `listMine`, and `ShelfSync` caches it from there — the row's View
          // opens it editable as soon as it lands.
          await claim({ table: ownableTable(row), entityId: row.serverId })
        },
      }),

    offer: (row) =>
      confirm({
        ...ROW_ACTION_COPY.offer(row.name, row.kind),
        onConfirm: async () => {
          await release({ table: ownableTable(row), entityId: row.serverId })
          // It belongs to the table now, not to this browser: keeping a local
          // copy would leave an editor whose writes the server refuses.
          await forgetLocal(row)
        },
      }),

    /**
     * Offered on every pilot and mech row, including a crewmate's and an
     * unclaimed pre-gen, because it is derived from what you may already read:
     * membership of the Game grants a read-only view of every row's sheet, and
     * copying what is on your screen escalates nothing. It is also the only way
     * to keep a character when you walk away from a table — releasing one
     * leaves it behind, unclaimed.
     *
     * It asks first even though it destroys nothing: it makes a second build,
     * and a player who expected a move would otherwise find two of them.
     */
    copy: (row) =>
      confirm({
        ...ROW_ACTION_COPY.copy(row.name),
        onConfirm: async () => {
          const created = await useEntityStore
            .getState()
            .create(
              row.kind === 'pilot' ? 'pilot' : 'mech',
              copyForShelf(row.body, row.name) as never
            )
          toast.success(`Copied ${created.name} to My stuff.`)
        },
      }),

    /**
     * The move the live sheet's "In:" select makes, offered from the row. It
     * goes through the store like that one does — it is a container patch on
     * the copy this browser holds, which the store mirrors up (and routes a
     * crawler through `entities.moveCrawler`). The surface offers it only on a
     * row whose copy has arrived (`row.localId`), so there is always one here.
     */
    removeFromGame: (row, gameName) =>
      confirm({
        ...ROW_ACTION_COPY.leaveGame({
          name: row.name,
          kind: row.kind,
          from: gameName,
          to: SHELF,
        }),
        onConfirm: async () => {
          // Unreachable from the hub, which offers this only once the copy has
          // arrived — so reaching it is a defect, and the confirm reports it.
          if (row.localId === null) throw new Error('Remove from game offered with no local copy')
          await useEntityStore
            .getState()
            .update(row.kind, row.localId, moveTo(SHELF), CONTAINER_MOVE)
        },
      }),

    remove: (row) =>
      confirm({
        ...ROW_ACTION_COPY.deleteFromGame(row.name),
        onConfirm: async () => {
          // Server first, addressed by server id: the row may never have been
          // in this browser, and a template pre-gen has no appId for the mirror
          // to address it by.
          await removeEntity({ table: ownableTable(row), entityId: row.serverId })
          // Then drop the cached copy, exactly as release and scrap do.
          // `forget`, not `delete`: the server row is already gone, so a second
          // mirrored destruction would be a no-op at best.
          await forgetLocal(row)
        },
      }),

    scrap: (row) =>
      confirm({
        ...ROW_ACTION_COPY.scrap(row.name),
        onConfirm: async () => {
          await scrapCrawler({ crawlerId: row.serverId as Id<'crawlers'> })
          await forgetLocal(row)
        },
      }),
  }
}
