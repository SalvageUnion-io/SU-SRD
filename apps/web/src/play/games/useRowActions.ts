/**
 * The destructive and ownership verbs on a Game's crew row, each behind its
 * confirm, but for three that land at once with Undo in their toast: a
 * player's **Assign to me** (r6 C8), the table runner's **Assign to …**
 * (MD4-09: six pre-gens were eighteen presses) and the Organiser's **Take off
 * the roster** (LG4-20). None destroys anything and each is one press to take back.
 *
 * Every other verb here changes who has a build or whether it exists — taking
 * it, unassigning it, moving it out, deleting it, scrapping the crawler — so
 * none of them runs on the press. Copying is Build's (the Training Bay's ⋯ menu):
 * Play only plays. Each opens the surface's confirm (`useConfirm`) with
 * its words from `lib/games/rowActionCopy.ts`, and does the work only when the
 * player confirms. A failure stays on the dialog with its reason.
 *
 * Kept out of `GameRoster` so another surface that lists the same rows offers
 * the same verbs with the same consequences, rather than a second copy of each
 * mutation sequence drifting from the first. What a row is ALLOWED to do is
 * still `row.can` (`lib/games/gameRoster.ts`); this only does it.
 */

import { moveTo, SHELF } from 'game-domain/container'
import { PRODUCT } from 'game-domain/product'
import { toast } from '../../components/index'
import type { Confirm } from '../../components/shared/useConfirm'
import { failureMessage } from '../../lib/connection/useServerAction'
import { handedBack } from '../../lib/games/assignmentNotices'
import type { GameMember, RosterRow } from '../../lib/games/gameRoster'
import { ROW_ACTION_COPY } from '../../lib/games/rowActionCopy'
import { componentsCopy } from '../../messages/components'
import { libGamesCopy } from '../../messages/lib-games'
import { playGamesCopy } from '../../messages/play-games'
import { CONTAINER_MOVE } from '../../replica/provenance'
import { useGamesCall } from '../../replica/roomCalls'
import { useUnits } from '../../replica/units'

export type RowActions = {
  /** Assign an unassigned character to yourself; `RoomFeed` brings it into this browser. */
  assignSelf: (row: RosterRow) => void
  /**
   * The table runner's: assign a character to `member`, whoever holds it now.
   * At once, with Undo in the toast (MD4-09); `self` when the member is the
   * viewer, so the toast says "you".
   */
  assignTo: (row: RosterRow, member: GameMember, self: boolean) => void
  /**
   * The Organiser's: take an unused pre-generated pilot, and the mech it came
   * with (`mech`, for the toast and its notice), off the roster to their
   * Training Bay. At once, with Undo in the toast.
   */
  takeOffRoster: (row: RosterRow, mech: { id: string; name: string } | null) => void
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

export function useRowActions(confirm: Confirm, gameId: string): RowActions {
  // The rooms need the Game a row is in, which the row itself does not name.
  const assign = useGamesCall('ownership.assign', { gameId })
  const unassign = useGamesCall('ownership.unassign', { gameId })
  const scrapCrawler = useGamesCall('entities.removeCrawler', { gameId })
  const removeEntity = useGamesCall('entities.remove', { gameId })
  const takeOff = useGamesCall('games.takeOffRoster', { gameId })
  const putBack = useGamesCall('games.putBack', { gameId })

  /** Drop this browser's cached copy once the server no longer lets us hold it. */
  async function forgetLocal(row: RosterRow): Promise<void> {
    if (row.localId !== null) await useUnits.getState().forget(row.kind, row.localId)
  }

  /** Give up a unit of the viewer's own, or take one (`taking`), without being told of it (`assignmentNotices`). */
  async function ownDoing(
    row: RosterRow,
    act: () => Promise<unknown>,
    taking = false
  ): Promise<void> {
    const undo = row.owner?.mine === true || taking ? handedBack(row.appId ?? row.serverId) : null
    try {
      await act()
    } catch (err) {
      undo?.()
      throw err
    }
  }

  return {
    // At once, with Undo in its toast (r6 C8): Unassign takes it back, so no confirm asks first.
    assignSelf: (row) => {
      const failed = libGamesCopy('assignSelfFailed', { name: row.name })
      // Nothing to pull down by hand: it is yours now, so it is in
      // `listMine`, and `RoomFeed` caches it from there — the row's View
      // opens it editable as soon as it lands.
      ownDoing(row, () => assign({ entityId: row.serverId }), true).then(
        () =>
          toast.success(playGamesCopy('assignedToYou', { name: row.name }), {
            id: `assigned:${row.serverId}`,
            action: {
              label: componentsCopy('undo'),
              onClick: () => {
                ownDoing(row, () => unassign({ entityId: row.serverId })).catch((err: unknown) =>
                  toast.error(failureMessage(err, failed))
                )
              },
            },
          }),
        (err: unknown) => toast.error(failureMessage(err, failed))
      )
    },

    assignTo: (row, member, self) => {
      const to = self ? 'you' : member.displayName
      const failed = libGamesCopy('assignToFailed', { name: row.name, to })
      const was = row.ownerId
      // Their own doing, so no notice of it (`assignmentNotices`). The copy
      // here stays: the room serves it with its new holder, and a sheet that
      // is not yours opens read-only (MD-10).
      ownDoing(row, () => assign({ entityId: row.serverId, userId: member.userId }), self).then(
        () =>
          toast.success(
            self
              ? playGamesCopy('assignedToYou', { name: row.name })
              : playGamesCopy('assignedTo', { name: row.name, to }),
            {
              id: `assigned:${row.serverId}`,
              action: {
                label: componentsCopy('undo'),
                // Back to whoever held it, or to nobody.
                onClick: () => {
                  const back = () =>
                    was === null
                      ? unassign({ entityId: row.serverId })
                      : assign({ entityId: row.serverId, userId: was })
                  ownDoing(row, back, true).catch((err: unknown) =>
                    toast.error(failureMessage(err, failed))
                  )
                },
              },
            }
          ),
        (err: unknown) => toast.error(failureMessage(err, failed))
      )
    },

    takeOffRoster: (row, mech) => {
      const failed = playGamesCopy('couldNotTakeOffRoster', { name: row.name })
      // It passes through the Organiser's hands on its way out: not news to them.
      const quiet = [handedBack(row.serverId), ...(mech === null ? [] : [handedBack(mech.id)])]
      takeOff({ pilotId: row.serverId }).then(
        (unitIds) =>
          toast.success(
            mech !== null && unitIds.includes(mech.id)
              ? playGamesCopy('tookOffRosterWithMech', {
                  name: row.name,
                  mech: mech.name,
                  build: PRODUCT.build,
                })
              : playGamesCopy('tookOffRoster', { name: row.name, build: PRODUCT.build }),
            {
              id: `off-roster:${row.serverId}`,
              action: {
                label: componentsCopy('undo'),
                onClick: () => {
                  for (const id of unitIds) handedBack(id)
                  putBack({ unitIds }).catch((err: unknown) =>
                    toast.error(
                      failureMessage(err, playGamesCopy('couldNotPutBack', { name: row.name }))
                    )
                  )
                },
              },
            }
          ),
        (err: unknown) => {
          for (const again of quiet) again()
          toast.error(failureMessage(err, failed))
        }
      )
    },

    unassign: (row) =>
      confirm({
        ...ROW_ACTION_COPY.unassign(row.name, row.kind, row.owner?.mine === true),
        onConfirm: async () => {
          // The copy here stays (MD-10): the room serves it again as
          // unassigned, and dropping it took its line off the Crew list until
          // a reload. A sheet nobody holds opens read-only.
          await ownDoing(row, () => unassign({ entityId: row.serverId }))
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
          await removeEntity({ entityId: row.serverId })
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
          await scrapCrawler({ crawlerId: row.serverId })
          await forgetLocal(row)
        },
      }),
  }
}
