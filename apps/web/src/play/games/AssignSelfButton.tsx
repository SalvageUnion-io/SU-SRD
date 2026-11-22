/**
 * AssignSelfButton — **Assign to me** on an unassigned pre-gen's own sheet
 * (r6 C8, LG6-09): the read-only banner that says nobody holds it carries the
 * same act the Game page's seal does, so a player who opened the sheet to read
 * it claims it there, with no trip Back. At once, with Undo in its toast
 * (Unassign takes it back), as the seal does (`useRowActions`). Once it lands
 * the sheet is the player's and opens editable (`RoomFeed` brings it in).
 */

import { Button, toast } from '../../components/index'
import { failureMessage } from '../../lib/connection/useServerAction'
import { handedBack } from '../../lib/games/assignmentNotices'
import { componentsCopy } from '../../messages/components'
import { libGamesCopy } from '../../messages/lib-games'
import { playGamesCopy } from '../../messages/play-games'
import { useGamesCall } from '../../replica/roomCalls'
import { useSync } from '../../replica/syncContext'

export function AssignSelfButton({
  gameId,
  entityId,
  appId,
  name,
}: {
  gameId: string
  /** The Game's id for it (the listing row's `_id`). */
  entityId: string
  /** Its sheet's id, by which this browser hears it arrive. */
  appId: string
  name: string
}) {
  const { canWrite } = useSync()
  const assign = useGamesCall('ownership.assign', { gameId })
  const unassign = useGamesCall('ownership.unassign', { gameId })
  const failed = libGamesCopy('assignSelfFailed', { name })

  function take() {
    // The player's own doing: no "assigned to you" notice of it (`assignmentNotices`).
    const quiet = handedBack(appId)
    assign({ entityId }).then(
      () =>
        toast.success(playGamesCopy('assignedToYou', { name }), {
          id: `assigned:${entityId}`,
          action: {
            label: componentsCopy('undo'),
            onClick: () => {
              const again = handedBack(appId)
              unassign({ entityId }).catch((err: unknown) => {
                again()
                toast.error(failureMessage(err, failed))
              })
            },
          },
        }),
      (err: unknown) => {
        quiet()
        toast.error(failureMessage(err, failed))
      }
    )
  }

  return (
    <Button
      variant="primary"
      size="compact"
      disabled={!canWrite}
      aria-label={playGamesCopy('assignToMeNamed', { name })}
      onClick={take}
    >
      {playGamesCopy('assignToMe')}
    </Button>
  )
}
