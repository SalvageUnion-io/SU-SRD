/**
 * The destructive and ownership verbs on a Game's crew row, each behind its
 * confirm.
 *
 * Every verb here changes who has a build or whether it exists — assigning it,
 * unassigning it, moving it out, deleting it, scrapping the crawler — so none
 * of them runs on the press. Copying is Build's (the Training Bay's ⋯ menu):
 * Play only plays. Each opens the surface's confirm (`useConfirm`) with
 * its words from `lib/games/rowActionCopy.ts`, and does the work only when the
 * player confirms. A failure stays on the dialog with its reason.
 *
 * Kept out of `GameRoster` so another surface that lists the same rows offers
 * the same verbs with the same consequences, rather than a second copy of each
 * mutation sequence drifting from the first. What a row is ALLOWED to do is
 * still `row.can` (`lib/games/gameRoster.ts`); this only does it.
 */

import { useMutation } from 'convex/react'
import { moveTo, SHELF } from 'game-domain/container'
import type { OwnableTable } from 'game-domain/entityKinds'
import { api } from '../../../convex/_generated/api'
import type { Id } from '../../../convex/_generated/dataModel'
import type { Confirm } from '../../components/shared/useConfirm'
import type { GameMember, RosterRow } from '../../lib/games/gameRoster'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { CONTAINER_MOVE } from '../../replica/provenance'
import { useUnits } from '../../replica/units'

/** The table a pilot or mech row's ownership mutations address. */
function ownableTable(row: RosterRow): OwnableTable {
  return row.kind === 'pilot' ? 'pilots' : 'mechs'
}

export type RowActions = {
  /** Assign an unassigned character to yourself; `ConvexFeed` brings it into this browser. */
  assignSelf: (row: RosterRow) => void
  /**
   * The table runner's: assign a character to `member`, whoever holds it now.
   * `self` when the member is the viewer, so the confirm says "you".
   */
  assignTo: (row: RosterRow, member: GameMember, self: boolean) => void
  /** Hand a character back to the crew: its holder's, or the table runner's. */
  unassign: (row: RosterRow) => void
  /**
   * Take a build out of the Game it is in, to your shelves — same record, same id
   * (a move, never a copy). `gameName` names the Game in the confirm.
   */
  removeFromGame: (row: RosterRow, gameName: string | null) => void
  /** Delete a pilot or mech you own, for everyone. */
  remove: (row: RosterRow) => void
  /** Scrap the crew's crawler (the table runner's act). */
  scrap: (row: RosterRow) => void
}

export function useRowActions(confirm: Confirm): RowActions {
  const assign = useMutation(api.ownership.assign)
  const unassign = useMutation(api.ownership.unassign)
  const scrapCrawler = useMutation(api.entities.removeCrawler)
  const removeEntity = useMutation(api.entities.remove)

  /** Drop this browser's cached copy once the server no longer lets us hold it. */
  async function forgetLocal(row: RosterRow): Promise<void> {
    if (row.localId !== null) await useUnits.getState().forget(row.kind, row.localId)
  }

  return {
    assignSelf: (row) =>
      confirm({
        ...ROW_ACTION_COPY.assignSelf(row.name),
        onConfirm: async () => {
          // Nothing to pull down by hand: it is yours now, so it is in
          // `listMine`, and `ConvexFeed` caches it from there — the row's View
          // opens it editable as soon as it lands.
          await assign({ table: ownableTable(row), entityId: row.serverId })
        },
      }),

    assignTo: (row, member, self) =>
      confirm({
        ...ROW_ACTION_COPY.assignTo(
          row.name,
          row.kind,
          self ? 'you' : member.displayName,
          row.owner === null || row.owner.unassigned
            ? null
            : row.owner.mine
              ? 'you'
              : row.owner.label
        ),
        onConfirm: async () => {
          await assign({
            table: ownableTable(row),
            entityId: row.serverId,
            userId: member.userId as Id<'users'>,
          })
          // Handed to somebody else, it is no longer this browser's to edit.
          if (row.owner?.mine === true) await forgetLocal(row)
        },
      }),

    unassign: (row) =>
      confirm({
        ...ROW_ACTION_COPY.unassign(row.name, row.kind, row.owner?.mine === true),
        onConfirm: async () => {
          await unassign({ table: ownableTable(row), entityId: row.serverId })
          // It belongs to the table now, not to this browser: keeping a local
          // copy would leave an editor whose writes the server refuses.
          await forgetLocal(row)
        },
      }),

    /**
     * The move the live sheet's "In:" select makes, offered from the row. It
     * goes through the store like that one does — it is a container patch on
     * the copy this browser holds, which the store commits server-first (and
     * routes a crawler through `entities.moveCrawler`). The surface offers it only on a
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
          if (row.localId === null)
            throw new Error('Move to your Training Bay offered with no local copy')
          await useUnits.getState().update(row.kind, row.localId, moveTo(SHELF), CONTAINER_MOVE)
        },
      }),

    remove: (row) =>
      confirm({
        ...ROW_ACTION_COPY.deleteFromGame(row.name),
        onConfirm: async () => {
          // Server first, addressed by server id: the row may never have been
          // in this browser, and a template pre-gen has no appId for
          // `sendRow` to address it by.
          await removeEntity({ table: ownableTable(row), entityId: row.serverId })
          // Then drop the cached copy, exactly as release and scrap do.
          // `forget`, not `delete`: the server row is already gone, so a second
          // server delete would be a no-op at best.
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
